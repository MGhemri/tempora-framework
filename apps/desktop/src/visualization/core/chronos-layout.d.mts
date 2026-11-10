export type ChronosEntry=Readonly<{
 reference:string;label:string;y:number;
 start_earliest:string;start_latest:string;end_earliest:string|null;end_latest:string|null;
 start_x0:number;start_x1:number;end_x0:number|null;end_x1:number|null;
 unknown_end:boolean;uncertain:boolean;certain_duration:boolean;
}>;
export type ChronosLayout=Readonly<{
 view:'read_only_civil_date_plot';entries:readonly ChronosEntry[];
 axis:Readonly<{earliest:string;latest:string;x0:number;x1:number}>|null;
 height:number;omitted:number;unknown_end_count:number;uncertain_count:number;
}>;
export function layoutDeclaredChronology(rows:readonly Record<string,unknown>[]):ChronosLayout;
