import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
export default function ConsultLogo({
  width = 120,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={className}
      style={{
        width,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "#176c72",
        fontWeight: 650,
        fontSize: width > 150 ? 32 : 20,
      }}
    >
      <Activity size={width > 150 ? 34 : 24} />
      <span>{t("clinical.brand")}</span>
    </div>
  );
}
