/**
 * Third-person player controller.
 *
 * Movement is camera relative: `W` always moves the player in the direction
 * the camera is looking. Collision uses the analytic terrain height function
 * plus circle colliders for props.
 */

import * as THREE from 'three';
import { PLAYER } from '../config';
import { heightAt } from '../world/terrain';
import { WORLD } from '../config';
import {
  canMoveTo,
  moveWithSliding,
  waterDepthAt,
  type SpatialHash,
} from '../systems/CollisionSystem';
import { clamp, damp, rotateToward } from '../utils/math';
import { PlayerAvatar } from './PlayerAvatar';

export class Player {
  readonly avatar = new PlayerAvatar();
  readonly position = new THREE.Vector3();
  /** Facing direction (radians, 0 = looking down +Z). */
  yaw = 0;

  private readonly velocity = new THREE.Vector3();
  private verticalVelocity = 0;
  private grounded = true;
  private bobPhase = 0;
  /** Set for one frame when the player is blocked, used for feedback. */
  blocked = false;
  /** True while the player is swimming in water too deep to wade. */
  swimming = false;
  /** True when the player owns something that lets them swim. */
  canSwim = false;

  constructor(spawnX: number, spawnZ: number) {
    this.position.set(spawnX, heightAt(spawnX, spawnZ), spawnZ);
    this.avatar.setPosition(this.position.x, this.position.y, this.position.z);
  }

  /**
   * Multiplies the walking speed. Hunger and other conditions slow the
   * traveller down without touching the movement code.
   */
  speedScale = 1;

  /** Horizontal speed in world units per second. */
  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  get isSprinting(): boolean {
    return this.speed > PLAYER.walkSpeed * 1.15;
  }

  get isMoving(): boolean {
    return this.speed > 0.15;
  }

  /**
   * Advances the player by one frame.
   *
   * @param dt          delta time in seconds
   * @param moveInput   world-space desired direction (already normalised)
   * @param sprint      whether the sprint key is held
   * @param jump        whether the jump key was pressed this frame
   * @param colliders   spatial hash of the static circle colliders
   */
  update(
    dt: number,
    moveInput: { x: number; z: number },
    sprint: boolean,
    jump: boolean,
    colliders: SpatialHash,
  ): void {
    const inputLength = Math.hypot(moveInput.x, moveInput.z);
    const maxSpeed =
      PLAYER.walkSpeed * this.speedScale * (sprint ? PLAYER.sprintMultiplier : 1);

    let targetX = 0;
    let targetZ = 0;
    if (inputLength > 0.001) {
      targetX = (moveInput.x / inputLength) * maxSpeed;
      targetZ = (moveInput.z / inputLength) * maxSpeed;
    }

    // Accelerate / decelerate.
    const rate = inputLength > 0.001 ? PLAYER.acceleration : PLAYER.deceleration;
    this.velocity.x = moveTowards(this.velocity.x, targetX, rate * dt);
    this.velocity.z = moveTowards(this.velocity.z, targetZ, rate * dt);

    // --- Horizontal movement with collision ------------------------------
    const nextX = this.position.x + this.velocity.x * dt;
    const nextZ = this.position.z + this.velocity.z * dt;

    // Only the colliders near the player can possibly matter this frame.
    const nearby = colliders.query(
      this.position.x,
      this.position.z,
      PLAYER.radius + Math.max(1, Math.hypot(nextX - this.position.x, nextZ - this.position.z)) + 1,
    );

    const currentGround = heightAt(this.position.x, this.position.z);
    const currentDepth = waterDepthAt(this.position.x, this.position.z);

    // Swimming starts as soon as the water is deeper than the player can
    // wade — and only if they own a swimsuit.
    this.swimming = this.canSwim && currentDepth > PLAYER.maxWadeDepth;

    const canStandAt = (x: number, z: number): boolean =>
      canMoveTo(x, z, {
        currentDepth,
        currentGround,
        maxWadeDepth: PLAYER.maxWadeDepth,
        maxSlope: PLAYER.maxSlope,
        canSwim: this.canSwim,
        swimming: this.swimming,
      });

    const result = moveWithSliding(
      this.position.x,
      this.position.z,
      nextX,
      nextZ,
      PLAYER.radius,
      nearby,
      canStandAt,
    );
    this.blocked = result.blocked;

    // Kill the velocity component that was blocked so we do not "stick".
    if (result.blocked) {
      const movedX = result.x - this.position.x;
      const movedZ = result.z - this.position.z;
      const travelled = Math.hypot(movedX, movedZ);
      const intended = Math.hypot(this.velocity.x, this.velocity.z) * dt;
      if (travelled < intended * 0.5) {
        this.velocity.multiplyScalar(0.35);
      }
    }

    this.position.x = result.x;
    this.position.z = result.z;

    // --- Vertical --------------------------------------------------------
    const ground = heightAt(this.position.x, this.position.z);
    if (this.swimming) {
      // Float on the surface.
      this.position.y = WORLD.waterLevel - 0.35;
      this.verticalVelocity = 0;
      this.grounded = false;
      this.avatar.setPosition(this.position.x, this.position.y, this.position.z);
      this.avatar.setRotation(this.yaw);
      this.avatar.update(dt, clamp(this.speed / PLAYER.walkSpeed, 0, 1));
      return;
    }
    if (jump && this.grounded) {
      this.verticalVelocity = PLAYER.jumpSpeed;
      this.grounded = false;
    }

    if (this.grounded) {
      // Stick to the ground, but detach when the surface drops away.
      if (ground < this.position.y - 0.55) {
        this.grounded = false;
        this.verticalVelocity = 0;
      } else {
        this.position.y = damp(this.position.y, ground, 22, dt);
      }
    }

    if (!this.grounded) {
      this.verticalVelocity -= PLAYER.gravity * dt;
      this.position.y += this.verticalVelocity * dt;
      if (this.position.y <= ground) {
        this.position.y = ground;
        this.verticalVelocity = 0;
        this.grounded = true;
      }
    }

    // --- Facing ----------------------------------------------------------
    if (this.isMoving) {
      const desired = Math.atan2(this.velocity.x, this.velocity.z);
      this.yaw = rotateToward(this.yaw, desired, dt * 12);
    }

    // --- Visuals ---------------------------------------------------------
    this.avatar.setPosition(this.position.x, this.position.y, this.position.z);
    this.avatar.setRotation(this.yaw);

    const speed01 = clamp(this.speed / (PLAYER.walkSpeed * PLAYER.sprintMultiplier), 0, 1);
    this.avatar.update(dt, speed01);

    if (this.isMoving) {
      this.bobPhase += dt * this.speed;
    }
  }

  /** How deep the player stands in water (0 on dry land). */
  get waterDepth(): number {
    return waterDepthAt(this.position.x, this.position.z);
  }

  /**
   * True while the traveller's head is under water.
   *
   * Swimming on the surface is cheap; being under the water is what really
   * costs you, and it is what the diving clothes are for.
   */
  get isUnderwater(): boolean {
    return this.waterDepth > PLAYER.height * 0.85;
  }

  /** Teleports the player (used when loading a save). */
  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.avatar.setPosition(x, y, z);
  }
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}
