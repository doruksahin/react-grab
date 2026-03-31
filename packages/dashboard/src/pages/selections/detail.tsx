import { useParams } from "react-router";

export default function SelectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <div>Selection Detail: {id} — TODO</div>;
}
