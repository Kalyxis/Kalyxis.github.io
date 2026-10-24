import { useAppStore, type ToastState } from '../../store/useAppStore'

let nextId = 1

export class ToastService {
  show(message: string, kind: ToastState['kind'] = 'info', action?: ToastState['action']): void {
    useAppStore.setState({ toast: { id: nextId++, message, kind, action } })
  }

  success(message: string): void {
    this.show(message, 'success')
  }

  error(message: string): void {
    this.show(message, 'error')
  }

  dismiss(id?: number): void {
    const current = useAppStore.getState().toast
    if (current && (id === undefined || current.id === id)) useAppStore.setState({ toast: null })
  }
}
