import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tags, Search } from "lucide-react";
import api from "../services/api";
import {
  PageHead,
  Panel,
  Loading,
  ErrorState,
  Empty,
} from "../components/design";
export default function Categories() {
  const [type, setType] = useState("EXPENSE"),
    [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });
  const list = (query.data || []).filter(
    (c) =>
      !c.owner_user_id &&
      c.type === type &&
      c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="cf-stack">
      <PageHead
        eyebrow="DANH MỤC DÙNG CHUNG"
        title="Danh mục hệ thống"
        description="Tra cứu các danh mục mặc định được dùng chung cho người dùng."
      />
      <div className="cf-row cf-between">
        <div className="cf-tabs" role="tablist" aria-label="Loại danh mục">
          {[
            ["EXPENSE", "Chi tiêu"],
            ["INCOME", "Thu nhập"],
          ].map(([v, l]) => (
            <button
              key={v}
              role="tab"
              aria-selected={type === v}
              onClick={() => setType(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="cf-search">
          <Search />
          <input
            className="cf-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Tìm danh mục"
            placeholder="Tìm danh mục…"
          />
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => query.refetch()} />
      ) : !list.length ? (
        <Panel>
          <Empty title="Không có danh mục phù hợp" />
        </Panel>
      ) : (
        <div className="cf-grid">
          {list.map((c) => (
            <Panel key={c.id}>
              <div className="cf-panel-body cf-row">
                <span className="cf-icon">
                  <Tags />
                </span>
                <h2 style={{ flex: 1 }}>{c.name}</h2>
                <span className="cf-badge">Hệ thống</span>
              </div>
            </Panel>
          ))}
        </div>
      )}
      <p className="cf-muted" style={{ fontSize: 13 }}>
        Danh mục dùng chung hiện được quản lý trong cấu hình dữ liệu hệ thống.
      </p>
    </div>
  );
}
