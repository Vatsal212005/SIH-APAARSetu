"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("input", className)} {...props} />
));
Input.displayName = "Input";

export function Label({
  className,
  htmlFor,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  const ref = React.useRef<HTMLLabelElement>(null),
    id = React.useId();
  React.useEffect(() => {
    if (!htmlFor && ref.current) {
      const control = ref.current.nextElementSibling;
      if (
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLTextAreaElement
      ) {
        if (!control.id) control.id = id;
        ref.current.htmlFor = control.id;
      }
    }
  }, [htmlFor, id]);
  return (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={cn("label", className)}
      {...props}
    />
  );
}
