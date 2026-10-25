import { create } from 'zustand';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'default' | 'danger';
  resolve: (ok: boolean) => void;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  ask: (opts: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>;
  close: (ok: boolean) => void;
}

/** Diálogo de confirmação acessível para ações importantes (compras, reset, dispensas). */
export const useConfirm = create<ConfirmState>()((set, get) => ({
  request: null,
  ask(opts) {
    return new Promise<boolean>((resolve) => {
      const current = get().request;
      current?.resolve(false);
      set({ request: { ...opts, resolve } });
    });
  },
  close(ok) {
    const request = get().request;
    request?.resolve(ok);
    set({ request: null });
  },
}));

export function confirmAction(opts: Omit<ConfirmRequest, 'resolve' | 'confirmLabel' | 'tone'> & Partial<Pick<ConfirmRequest, 'confirmLabel' | 'tone'>>): Promise<boolean> {
  return useConfirm.getState().ask({ confirmLabel: 'Confirmar', tone: 'default', ...opts });
}
