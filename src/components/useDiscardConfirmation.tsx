'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function DiscardDialog({ onDecision }: { onDecision: (discard: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return (
    <dialog ref={dialog} aria-labelledby="discard-title" onCancel={(event) => { event.preventDefault(); onDecision(false); }} className="fixed inset-0 m-auto max-w-md rounded-lg border border-amber-300/30 bg-slate-950 p-6 text-white backdrop:bg-black/75">
      <h2 id="discard-title" className="text-lg font-semibold">Unsaved changes</h2>
      <p className="mt-3 text-sm text-slate-300">Your changes have not been saved. Keep editing, or discard them to continue.</p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={() => onDecision(false)} className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold">Keep editing</button>
        <button type="button" onClick={() => onDecision(true)} className="rounded-md bg-rose-500 px-4 py-2 text-sm font-semibold">Discard changes</button>
      </div>
    </dialog>
  );
}

export function useDiscardConfirmation() {
  const [open, setOpen] = useState(false);
  const pending = useRef<{ promise: Promise<boolean>; resolve: (answer: boolean) => void } | null>(null);
  const ask = useCallback(() => {
    // One confirmation approves one action; a concurrent Back/Edit request must
    // not inherit approval for a different action already awaiting a decision.
    if (pending.current) return Promise.resolve(false);
    let resolve!: (answer: boolean) => void;
    const promise = new Promise<boolean>((done) => { resolve = done; });
    pending.current = { promise, resolve };
    setOpen(true);
    return promise;
  }, []);
  function decide(answer: boolean) {
    pending.current?.resolve(answer);
    pending.current = null;
    setOpen(false);
  }
  useEffect(() => () => { pending.current?.resolve(false); }, []);
  return { ask, dialog: open ? <DiscardDialog onDecision={decide} /> : null };
}
