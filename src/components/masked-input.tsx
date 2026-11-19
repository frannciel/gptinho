"use client";
import { useRef, type InputHTMLAttributes } from "react";
import { maskCnpj, maskPhone, maskPostalCode } from "@/lib/input-masks";
type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "maxLength"
> & {
  value?: string;
  mask: "cnpj" | "phone" | "postalCode";
  onValueChange: (value: string) => void;
};
const formatters = {
  cnpj: maskCnpj,
  phone: maskPhone,
  postalCode: maskPostalCode,
};
const significant = (value: string) => value.replace(/[^a-z0-9+]/gi, "").length;
function caretPosition(value: string, count: number) {
  if (!count) return value.startsWith("(") ? 1 : 0;
  for (let index = 0, found = 0; index < value.length; index++) {
    if (/[a-z0-9+]/i.test(value[index]) && ++found === count) return index + 1;
  }
  return value.length;
}
export function MaskedInput({
  value = "",
  mask,
  onValueChange,
  ...props
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const format = formatters[mask];
  const update = (raw: string, prefix: string) => {
    const next = format(raw);
    onValueChange(next);
    const position = caretPosition(next, significant(prefix));
    requestAnimationFrame(() =>
      ref.current?.setSelectionRange(position, position),
    );
  };
  return (
    <input
      {...props}
      ref={ref}
      value={format(value)}
      type={mask === "phone" ? "tel" : "text"}
      inputMode={
        mask === "phone" ? "tel" : mask === "postalCode" ? "numeric" : "text"
      }
      autoCapitalize={mask === "cnpj" ? "characters" : "off"}
      onChange={(event) => {
        const caret = event.target.selectionStart ?? event.target.value.length;
        const raw = event.target.value;
        const inputType = (event.nativeEvent as InputEvent).inputType;
        // Mobile keyboards may delete punctuation without firing keydown.
        if (
          (inputType === "deleteContentBackward" ||
            inputType === "deleteContentForward") &&
          raw !== format(value) &&
          significant(raw) === significant(format(value))
        ) {
          let index = inputType === "deleteContentBackward" ? caret - 1 : caret;
          while (
            index >= 0 &&
            index < raw.length &&
            !/[a-z0-9+]/i.test(raw[index])
          )
            index += inputType === "deleteContentBackward" ? -1 : 1;
          if (index >= 0 && index < raw.length) {
            update(
              raw.slice(0, index) + raw.slice(index + 1),
              raw.slice(
                0,
                inputType === "deleteContentBackward" ? index : caret,
              ),
            );
            return;
          }
        }
        update(raw, raw.slice(0, caret));
      }}
      onKeyDown={(event) => {
        if (event.key !== "Backspace" && event.key !== "Delete") return;
        const {
          selectionStart: start,
          selectionEnd: end,
          value: current,
        } = event.currentTarget;
        if (start === null || start !== end) return;
        let index = event.key === "Backspace" ? start - 1 : start;
        if (
          index < 0 ||
          index >= current.length ||
          /[a-z0-9+]/i.test(current[index])
        )
          return;
        while (
          index >= 0 &&
          index < current.length &&
          !/[a-z0-9+]/i.test(current[index])
        )
          index += event.key === "Backspace" ? -1 : 1;
        if (index < 0 || index >= current.length) return;
        event.preventDefault();
        const raw = current.slice(0, index) + current.slice(index + 1);
        update(
          raw,
          current.slice(0, event.key === "Backspace" ? index : start),
        );
      }}
    />
  );
}
