"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({ label, error, hint, id, className, type = "text", ...inputProps }: FormFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputId = id ?? inputProps.name;
  const errorId = inputId ? `${inputId}-error` : undefined;
  const hintId = inputId ? `${inputId}-hint` : undefined;
  const isPassword = type === "password";
  const describedBy = [error ? errorId : undefined, hint ? hintId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-[0.83rem] font-medium tracking-[-0.01em] text-foreground">
        {label}
      </label>
      <div className="relative">
        <Input
          {...inputProps}
          id={inputId}
          type={isPassword && isPasswordVisible ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`h-[3.15rem] rounded-xl border-border/80 bg-background/80 px-4 shadow-[inset_0_1px_2px_rgb(22_46_34/3%)] placeholder:text-muted-foreground/65 focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10 ${isPassword ? "pr-12" : ""} ${className ?? ""}`}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            aria-pressed={isPasswordVisible}
            onClick={() => setIsPasswordVisible((visible) => !visible)}
          >
            {isPasswordVisible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
          </button>
        ) : null}
      </div>
      {hint ? <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      {error ? <p id={errorId} className="text-xs font-medium text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}

export function PasswordField(props: Omit<FormFieldProps, "type">) {
  return <FormField {...props} type="password" />;
}

export type FormSelectOption = { label: string; value: string };

type FormSelectFieldProps = {
  label: string;
  options: readonly FormSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
};

export function FormSelectField({ label, options, error, placeholder, id, name, value, onValueChange, disabled, required }: FormSelectFieldProps) {
  const selectId = id ?? name;
  const errorId = selectId ? `${selectId}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="block text-[0.83rem] font-medium tracking-[-0.01em] text-foreground">
        {label}
      </label>
      <SelectField
        id={selectId}
        name={name}
        value={value}
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        triggerClassName="h-[3.15rem] rounded-xl bg-background/80 px-4 text-base shadow-[inset_0_1px_2px_rgb(22_46_34/3%)] focus-visible:ring-4 focus-visible:ring-primary/10"
      />
      {error ? <p id={errorId} className="text-xs font-medium text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
