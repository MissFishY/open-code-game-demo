/**
 * Third-person orbit camera.
 *
 * The camera orbits around the player, driven by the mouse (pointer lock).
 * It keeps itself above the terrain and above the water so the player is
 * never hidden behind the ground.
 */

import * as THREE from 'three';
import { CAMERA, WORLD } from '../config';
import { heightAt } from '../world/terrain';
import { clamp, damp } from '../utils/math';

/** A vertical cylinder that the camera must not pass through. */
export interface CameraObstacle {
  x: number;
  z: number;
  /** Y of the cylinder's base. */
  baseY: number;
  radius: number;
  height: number;
}

export class CameraController {
  /** Horizontal orbit angle in radians. */
  yaw = 0;
  /** Vertical orbit angle in radians (positive = looking down). */
  pitch = 0.3;

  private readonly desired = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private distance: number = CAMERA.distance;
  private initialized = false;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /** Flat forward direction (the direction the player walks in with `W`). */
  get forwardX(): number {
    return -Math.sin(this.yaw);
  }

  get forwardZ(): number {
    return -Math.cos(this.yaw);
  }

  /** Flat right direction (the direction the player strafes with `D`). */
  get rightX(): number {
    return Math.cos(this.yaw);
  }

  get rightZ(): number {
    return -Math.sin(this.yaw);
  }

  /** Unit vector the camera is looking along, including the pitch. */
  get lookDirection(): THREE.Vector3 {
    const cosPitch = Math.cos(this.pitch);
    return new THREE.Vector3(
      -Math.sin(this.yaw) * cosPitch,
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch,
    );
  }

  /** Applies mouse movement to the orbit angles. */
  applyMouseDelta(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * CAMERA.sensitivity;
    this.pitch = clamp(this.pitch + deltaY * CAMERA.sensitivity, CAMERA.pitchMin, CAMERA.pitchMax);
  }

  /**
   * Places the camera behind the player.
   * @param target    the point to orbit around (roughly the player's chest)
   * @param obstacles cylinders the camera should not be pushed into
   */
  update(dt: number, target: THREE.Vector3, obstacles: readonly CameraObstacle[] = []): void {
    this.focus.copy(target);

    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cosPitch,
      sinPitch,
      Math.cos(this.yaw) * cosPitch,
    );

    // Pull the camera in when something is in the way.
    const wanted: number = CAMERA.distance;
    let distance: number = wanted;
    for (const obstacle of obstacles) {
      const hit = raycastAgainstCylinder(this.focus, offset, distance, obstacle);
      if (hit !== null && hit < distance) distance = Math.max(CAMERA.minDistance, hit);
    }
    this.distance = this.initialized ? damp(this.distance, distance, 12, dt) : distance;

    this.desired
      .copy(this.focus)
      .addScaledVector(offset, this.distance)
      .add(new THREE.Vector3(0, CAMERA.height * 0.25, 0));

    // Never sink into the terrain or below the water surface.
    const ground = Math.max(heightAt(this.desired.x, this.desired.z), WORLD.waterLevel) + 0.6;
    if (this.desired.y < ground) this.desired.y = ground;

    if (!this.initialized) {
      this.camera.position.copy(this.desired);
      this.initialized = true;
    } else {
      this.camera.position.x = damp(this.camera.position.x, this.desired.x, CAMERA.followLerp, dt);
      this.camera.position.y = damp(this.camera.position.y, this.desired.y, CAMERA.followLerp, dt);
      this.camera.position.z = damp(this.camera.position.z, this.desired.z, CAMERA.followLerp, dt);
    }

    this.lookTarget.copy(this.focus);
    this.lookTarget.y += 0.3;
    this.camera.lookAt(this.lookTarget);
  }

  /** Snaps the camera to its target without smoothing (used on load). */
  snap(target: THREE.Vector3): void {
    this.focus.copy(target);
    this.distance = CAMERA.distance;
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    this.desired.set(
      this.focus.x + Math.sin(this.yaw) * cosPitch * this.distance,
      this.focus.y + sinPitch * this.distance,
      this.focus.z + Math.cos(this.yaw) * cosPitch * this.distance,
    );
    const ground = Math.max(heightAt(this.desired.x, this.desired.z), WORLD.waterLevel) + 0.6;
    if (this.desired.y < ground) this.desired.y = ground;
    this.camera.position.copy(this.desired);
    this.camera.lookAt(this.focus.x, this.focus.y + 0.3, this.focus.z);
    this.initialized = true;
  }
}

/**
 * Ray/cylinder test used to keep the camera out of trees.
 * Returns the distance along the ray where the hit starts, or null.
 */
function raycastAgainstCylinder(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance: number,
  obstacle: CameraObstacle,
): number | null {
  const dirLen = Math.hypot(direction.x, direction.z);
  if (dirLen < 1e-4) return null;

  const ox = origin.x - obstacle.x;
  const oz = origin.z - obstacle.z;
  const dx = direction.x / dirLen;
  const dz = direction.z / dirLen;

  const a = dx * dx + dz * dz;
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - obstacle.radius * obstacle.radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  let t = (-b - root) / (2 * a);
  if (t < 0) t = (-b + root) / (2 * a);
  if (t < 0 || t > maxDistance) return null;

  // Check the vertical extent at the hit point.
  const hitY = origin.y + direction.y * t;
  if (hitY < obstacle.baseY - 0.5 || hitY > obstacle.baseY + obstacle.height) return null;

  return Math.max(0, t - 0.35);
}
