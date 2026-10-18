import { File, FileImage, FileText } from "lucide-react";
export default function FileIcon({
  path,
  size = 15,
}: {
  path: string;
  size?: number;
}) {
  const Icon = /\.pdf$/i.test(path)
    ? File
    : /\.(png|jpe?g|gif|webp|bmp|svg|ico)$/i.test(path)
      ? FileImage
      : FileText;
  return <Icon size={size} aria-hidden="true" />;
}
