"use client";
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {Badge,statusTone} from '@/components/ui/badge';
export function StudentProfile(){const query=useQuery({queryKey:['profile'],queryFn:()=>api<{name:string;masked_apaar:string;verification_status:string;provenance:Record<string,unknown>}>('/profile')});if(!query.data)return null;return <div className="page" style={{paddingBottom:0}}><Card><CardHeader><CardTitle>Academic identity and provenance</CardTitle></CardHeader><CardContent><div className="key-values"><div><strong>{query.data.name}</strong><p>{query.data.masked_apaar}</p></div><Badge tone={statusTone(query.data.verification_status)}>{query.data.verification_status}</Badge></div><details><summary>Sources supporting these claims</summary><pre className="result-panel">{JSON.stringify(query.data.provenance,null,2)}</pre></details></CardContent></Card></div>}
