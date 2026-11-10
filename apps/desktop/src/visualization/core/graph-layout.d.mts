export type DeclaredGraphRef=Readonly<{kind:string;namespace:string;id:string}>;
export type DeclaredGraphNode=Readonly<{key:string;ref:DeclaredGraphRef;x:number;y:number;component:number}>;
export type DeclaredGraphEdge=Readonly<{reference:string;source:string;target:string;predicate:string|null;self_loop:boolean}>;
export type DeclaredGraphLayout=Readonly<{
 view:'read_only_declared_relations';nodes:readonly DeclaredGraphNode[];
 edges:readonly DeclaredGraphEdge[];components:number;omitted:number;height:number;
 page_edges:number;displayed_edges:number;
}>;
export function layoutDeclaredGraph(rows:readonly Record<string,unknown>[]):DeclaredGraphLayout;
