import { useQuery } from "@tanstack/react-query";
import { SharedAccountPanel } from "../accounts/SharedAccountPanel";
import { apiClient } from "../../services/apiClient";

interface AccountItem {
  id: string;
  name: string;
}

export function SharedAccountsPage() {
  const accountsQuery = useQuery({
    queryKey: ["shared-account-page-accounts"],
    queryFn: async () => (await apiClient.get<AccountItem[]>("/accounts")).data,
    initialData: []
  });

  return <SharedAccountPanel accounts={accountsQuery.data} />;
}
