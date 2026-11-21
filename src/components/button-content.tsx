import { Save, X, Eraser, ArrowLeft, Search, LoaderCircle } from "lucide-react";
const actions = {
  save: { label: "Salvar", icon: Save },
  cancel: { label: "Cancelar", icon: X },
  clear: { label: "Limpar", icon: Eraser },
  back: { label: "Voltar", icon: ArrowLeft },
  filter: { label: "Filtrar", icon: Search },
};
export function ButtonContent({
  action,
  pending = false,
}: {
  action: keyof typeof actions;
  pending?: boolean;
}) {
  const { label, icon: Icon } = actions[action];
  return (
    <>
      {pending ? (
        <LoaderCircle size={17} className="animate-spin" />
      ) : (
        <Icon size={17} />
      )}
      <span>{pending ? "Salvando…" : label}</span>
    </>
  );
}
