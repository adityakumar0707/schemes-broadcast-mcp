"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

/** Submit button that gives immediate feedback: disables itself and shows a pending label while the form action runs. */
export default function SubmitButton({ children, pendingText = "Working…", className = "btn", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  return (
    <button
      {...rest}
      className={className}
      disabled={pending || rest.disabled}
      onClick={(e) => { setClicked(true); rest.onClick?.(e); }}
    >
      {pending && clicked ? pendingText : children}
    </button>
  );
}
