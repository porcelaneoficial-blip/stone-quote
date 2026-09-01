import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Material, CatalogService, CatalogSupply, Seller, TechMeasurer, FinishType } from "./types";

export type Catalog = {
  materials: Material[];
  services: CatalogService[];
  supplies: CatalogSupply[];
  sellers: Seller[];
  tech_measurers: TechMeasurer[];
  finish_types: FinishType[];
  loaded: boolean;
};

export function useCatalog(): Catalog {
  const [c, setC] = useState<Catalog>({
    materials: [], services: [], supplies: [], sellers: [], tech_measurers: [], finish_types: [], loaded: false,
  });
  useEffect(() => {
    (async () => {
      const [m, s, sp, se, tm, ft] = await Promise.all([
        supabase.from("materials").select("*").eq("active", true).order("category").order("name"),
        supabase.from("services").select("*").eq("active", true).order("name"),
        supabase.from("supplies").select("*").eq("active", true).order("name"),
        supabase.from("sellers").select("*").eq("active", true).order("name"),
        supabase.from("tech_measurers").select("*").eq("active", true).order("name"),
        supabase.from("finish_types").select("*").eq("active", true).order("name"),
      ]);
      setC({
        materials: (m.data ?? []) as Material[],
        services: (s.data ?? []) as CatalogService[],
        supplies: (sp.data ?? []) as CatalogSupply[],
        sellers: (se.data ?? []) as Seller[],
        tech_measurers: (tm.data ?? []) as TechMeasurer[],
        finish_types: (ft.data ?? []) as FinishType[],
        loaded: true,
      });
    })();
  }, []);
  return c;
}
