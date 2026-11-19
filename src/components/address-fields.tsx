"use client";
import { BRAZIL_STATES } from "@/lib/input-masks";
import { Field } from "./form-fields";
import { MaskedInput } from "./masked-input";
export type AddressValues = {
  address?: string;
  postalCode?: string;
  city?: string;
  state?: string;
};
export function AddressFields({
  values,
  errors,
  onChange,
}: {
  values: AddressValues;
  errors?: Record<string, string[]>;
  onChange: (key: keyof AddressValues, value: string) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field name="postalCode" label="CEP" error={errors?.postalCode}>
        <MaskedInput
          id="postalCode"
          className="field"
          mask="postalCode"
          value={values.postalCode}
          placeholder="00000-000"
          autoComplete="postal-code"
          aria-invalid={!!errors?.postalCode}
          aria-describedby={errors?.postalCode ? "postalCode-error" : undefined}
          onValueChange={(value) => onChange("postalCode", value)}
        />
      </Field>
      <Field name="city" label="Cidade" error={errors?.city}>
        <input
          id="city"
          className="field"
          value={values.city ?? ""}
          maxLength={120}
          autoComplete="address-level2"
          aria-invalid={!!errors?.city}
          aria-describedby={errors?.city ? "city-error" : undefined}
          onChange={(event) => onChange("city", event.target.value)}
        />
      </Field>
      <Field name="state" label="Estado (UF)" error={errors?.state}>
        <select
          id="state"
          className="field"
          value={values.state ?? ""}
          autoComplete="address-level1"
          aria-invalid={!!errors?.state}
          aria-describedby={errors?.state ? "state-error" : undefined}
          onChange={(event) => onChange("state", event.target.value)}
        >
          <option value="">Selecione</option>
          {BRAZIL_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field name="address" label="Endereço" error={errors?.address}>
          <input
            id="address"
            className="field"
            value={values.address ?? ""}
            maxLength={500}
            placeholder="Rua, número, complemento e bairro"
            autoComplete="street-address"
            aria-invalid={!!errors?.address}
            aria-describedby={errors?.address ? "address-error" : undefined}
            onChange={(event) => onChange("address", event.target.value)}
          />
        </Field>
        <p className="mt-1.5 text-xs text-slate-500">
          Informe CEP, cidade e estado nos campos próprios.
        </p>
      </div>
    </div>
  );
}
