import { useState, useRef, useEffect, useCallback, useId } from 'react';

export default function Dropdown({ trigger, children, align = 'right', role = 'menu' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = () => setOpen((o) => !o);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <div className="dropdown" ref={ref} role={role}>
      <div onClick={toggle}>{trigger}</div>
      {open && (
        <>
          <div className="backdrop" onClick={close} />
          <div className="dropdown-menu" style={{ right: align === 'right' ? 0 : 'auto', left: align === 'left' ? 0 : 'auto' }} role="menu" aria-label={id}>
            {typeof children === 'function' ? children({ close }) : children}
          </div>
        </>
      )}
    </div>
  );
}