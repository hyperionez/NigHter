import type { TrackedPosition } from "./types.js";

export class PositionStore {
  private readonly positions = new Map<string, TrackedPosition>();

  add(position: TrackedPosition): void {
    this.positions.set(position.positionId, position);
  }

  remove(positionId: string): void {
    this.positions.delete(positionId);
  }

  all(): TrackedPosition[] {
    return [...this.positions.values()];
  }

  get size(): number {
    return this.positions.size;
  }
}
