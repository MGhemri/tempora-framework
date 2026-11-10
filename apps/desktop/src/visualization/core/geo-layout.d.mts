export type GeoCluster=Readonly<{
  x:number; y:number; count:number; approximate:boolean;
  declared_precision_pixels:number; references:readonly string[];
}>;
export type GeoLayout=Readonly<{
  total:number; skipped:number; view:"read_only_coordinate_plot";
  clusters:readonly GeoCluster[];
  extent:Readonly<{
    west:number; east:number; south:number; north:number;
    antimeridian:boolean;
  }> | null;
}>;
export declare function layoutGeographicPoints(rows:readonly Record<string,unknown>[]):GeoLayout;
