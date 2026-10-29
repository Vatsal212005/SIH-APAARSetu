"use client";
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {Button} from '@/components/ui/button';
import {Badge,statusTone} from '@/components/ui/badge';
type Notice={id:string;title:string;body:string;severity:string;read:boolean;created_at:string};
export default function Notifications(){const client=useQueryClient();const query=useQuery({queryKey:['notifications'],queryFn:()=>api<{items:Notice[]}>('/notifications')});const mutation=useMutation({mutationFn:(id:string)=>api(`/notifications/${id}/read`,{method:'POST'}),onSuccess:()=>client.invalidateQueries({queryKey:['notifications']})});return <div className="page"><div className="page-title"><h1>Notification center</h1><p>Persistent submission, correction and review activity in your authorized scope.</p></div><div className="grid-list" style={{marginTop:20}}>{query.data?.items.map(n=><div className="card" style={{padding:18}} key={n.id}><Badge tone={statusTone(n.severity)}>{n.severity}</Badge><h3>{n.title}</h3><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString('en-IN')}</small> {!n.read&&<Button size="sm" variant="secondary" onClick={()=>mutation.mutate(n.id)}>Mark read</Button>}</div>)}</div></div>}
