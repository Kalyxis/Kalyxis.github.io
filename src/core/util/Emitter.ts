export type Listener<T> = (value: T) => void

/** Minimal typed event emitter used by services that UI code subscribes to. */
export class Emitter<T> {
  private readonly listeners = new Set<Listener<T>>()

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(value: T): void {
    for (const listener of Array.from(this.listeners)) listener(value)
  }
}
