/**
 * Form fields composed from HeroUI v3 primitives. Pages use these instead of composing
 * Label/Input/Description by hand, so every field looks and behaves the same.
 */
import { Description, FieldError, Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react"
import type { Key, ReactNode } from "react"

interface BaseProps {
  label: string
  description?: ReactNode
  /** Validation message; shown and marks the field invalid when set. */
  error?: string
  isRequired?: boolean
  isDisabled?: boolean
  className?: string
}

interface TextInputProps extends BaseProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: "text" | "number" | "tel" | "email" | "date" | "time" | "password" | "search"
  autoFocus?: boolean
  inputMode?: "numeric" | "decimal" | "text" | "tel"
  suffix?: ReactNode
  maxLength?: number
}

export function TextInput({ label, description, error, value, onChange, placeholder, type = "text", isRequired, isDisabled, autoFocus, inputMode, className, suffix, maxLength }: TextInputProps) {
  return (
    <TextField value={value} onChange={onChange} isRequired={isRequired} isDisabled={isDisabled} isInvalid={!!error} className={className} type={type} autoFocus={autoFocus} maxLength={maxLength}>
      <Label>{label}</Label>
      <div className="relative">
        <Input placeholder={placeholder} inputMode={inputMode} className={suffix ? "w-full pr-12" : "w-full"} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{suffix}</span>}
      </div>
      {description && !error && <Description>{description}</Description>}
      <FieldError>{error}</FieldError>
    </TextField>
  )
}

interface TextAreaInputProps extends BaseProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export function TextAreaInput({ label, description, error, value, onChange, placeholder, rows = 3, isRequired, isDisabled, className }: TextAreaInputProps) {
  return (
    <TextField value={value} onChange={onChange} isRequired={isRequired} isDisabled={isDisabled} isInvalid={!!error} className={className}>
      <Label>{label}</Label>
      <TextArea placeholder={placeholder} rows={rows} className="w-full" />
      {description && !error && <Description>{description}</Description>}
      <FieldError>{error}</FieldError>
    </TextField>
  )
}

export interface Option<V extends string = string> {
  value: V
  label: string
  description?: string
}

interface SelectInputProps<V extends string> extends BaseProps {
  value: V | null
  onChange: (value: V) => void
  options: Option<V>[]
  placeholder?: string
}

export function SelectInput<V extends string>({ label, description, error, value, onChange, options, placeholder = "Select…", isRequired, isDisabled, className }: SelectInputProps<V>) {
  return (
    <Select
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(key: Key | null) => key !== null && onChange(String(key) as V)}
      isRequired={isRequired}
      isDisabled={isDisabled}
      isInvalid={!!error}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      {description && !error && <Description>{description}</Description>}
      <FieldError>{error}</FieldError>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
              <div className="flex flex-col">
                <span>{o.label}</span>
                {o.description && <span className="text-xs text-muted">{o.description}</span>}
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
