import { forwardRef } from "react";
import { inputClass } from "./Input";

/** A native <select> styled like <Input>. Options are children, as usual. */
const Select = forwardRef(function Select({ error, className = "", children, ...props }, ref) {
  return (
    <select ref={ref} aria-invalid={error ? true : undefined} className={`${inputClass(error)} bg-white ${className}`} {...props}>
      {children}
    </select>
  );
});

export default Select;
