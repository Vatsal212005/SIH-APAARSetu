"use client";
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '@/lib/api';
import type {User} from '@/lib/types';
import {Button} from '@/components/ui/button';
import {Input,Label} from '@/components/ui/input';
import {Select} from '@/components/ui/select';
import {Alert} from '@/components/ui/alert';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {InstitutionImport} from '@/features/institution-import';
type Field={name:string;label?:string;type?:string;options?:{value:string;label:string}[];required?:boolean};
type Item=Record<string,string>;
export function WorkflowForm({title,path,method='POST',fields,onSaved}:{title:string;path:string;method?:string;fields:Field[];onSaved?:()=>void}){
 const client=useQueryClient();const[values,setValues]=useState<Record<string,string>>({});
 const mutation=useMutation({mutationFn:(submitted:Record<string,string>)=>{const data:Record<string,unknown>={};for(const f of fields){const value=submitted[f.name]||values[f.name]||f.options?.[0]?.value||'';if(value!=='')data[f.name]=f.type==='number'?Number(value):f.type==='boolean'?value==='true':value;}const target=path.replace('{id}',encodeURIComponent(String(data.id??'')));delete data.id;return api(target,{method,body:JSON.stringify(data)});},onSuccess:()=>{client.invalidateQueries();onSaved?.();}});
 return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><form className="form-stack" onSubmit={e=>{e.preventDefault();mutation.mutate(Object.fromEntries(Array.from(new FormData(e.currentTarget).entries()).map(([key,value])=>[key,String(value)])));}}><div className="key-values">{fields.map(f=><div key={f.name}><Label htmlFor={`${title}-${f.name}`}>{f.label??f.name.replaceAll('_',' ')}</Label>{f.options?<Select required={f.required!==false} name={f.name} id={`${title}-${f.name}`} value={values[f.name]??f.options[0]?.value??''} onChange={e=>setValues({...values,[f.name]:e.target.value})}>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select>:<Input name={f.name} id={`${title}-${f.name}`} required={f.required!==false} type={f.type??'text'} value={values[f.name]??''} onChange={e=>setValues({...values,[f.name]:e.target.value})}/>}</div>)}</div>{mutation.error&&<Alert title="Unable to save" tone="danger">{mutation.error.message}</Alert>}{mutation.isSuccess&&<Alert title="Saved" tone="success">The record and audit event have been persisted.</Alert>}<Button disabled={mutation.isPending||fields.some(f=>f.required!==false&&f.options!==undefined&&f.options.length===0)} type="submit">{mutation.isPending?'Saving…':'Save record'}</Button></form></CardContent></Card>;
}
export default function Management(){
 const[tab,setTab]=useState('student');const me=useQuery({queryKey:['me'],queryFn:()=>api<{user:User}>('/auth/me')});
 const institutions=useQuery({queryKey:['manage-institutions'],queryFn:()=>api<{items:Item[]}>('/institutions?page_size=100')});
 const programmes=useQuery({queryKey:['programmes'],queryFn:()=>api<{items:Item[]}>('/programmes')});
 const policies=useQuery({queryKey:['policies'],queryFn:()=>api<{items:Item[]}>('/policies')});
 const institutionOptions=(institutions.data?.items??[]).map(i=>({value:i.id,label:i.name}));
 const programmeOptions=(programmes.data?.items??[]).map(i=>({value:i.id,label:`${i.institution} — ${i.specialization}`}));
 const policyOptions=(policies.data?.items??[]).map(i=>({value:i.id,label:i.version}));
 const bool=(name:string):Field=>({name,type:'boolean',options:[{value:'false',label:'No'},{value:'true',label:'Yes'}]});
 const institution:Field={name:'institution_id',options:institutionOptions};const programme:Field={name:'programme_id',options:programmeOptions};
 const central=['aicte_admin','system_admin'].includes(me.data?.user.role??'');
 const userList=useQuery({queryKey:['users'],enabled:central,queryFn:()=>api<{items:Item[]}>('/users')});
 const forms:Record<string,{title:string;path:string;method?:string;fields:Field[]}>= {
 student:{title:'Register student and enrolment',path:'/students',fields:[institution,programme,{name:'academic_year'},{name:'apaar_id',label:'Synthetic 12-digit APAAR-like ID'},{name:'full_name'},{name:'date_of_birth',type:'date'},{name:'institution_student_id'},{name:'admission_date',type:'date'},{name:'seat_type',options:[{value:'regular',label:'Regular'},{value:'supernumerary',label:'Supernumerary'}]},bool('nri_category'),bool('oci_status'),bool('foreign_national')]},
 programme:{title:'Create programme',path:'/programmes',fields:[institution,{name:'code'},{name:'name'},{name:'specialization'},{name:'level',options:['UG','PG','Diploma'].map(value=>({value,label:value}))}]},
 institution:{title:'Register synthetic institution',path:'/institutions',fields:['permanent_id','name','institution_type','address','city','state','region','contact_email'].map(name=>({name,type:name==='contact_email'?'email':'text'}))},
 intake:{title:'Authorize demonstration intake',path:'/intakes',fields:[institution,programme,{name:'academic_year'},{name:'regular_capacity',type:'number'},{name:'supernumerary_capacity',type:'number'},{name:'nri_capacity',type:'number'},{name:'policy_id',options:policyOptions},{name:'effective_from',type:'date'}]},
 year:{title:'Create academic year',path:'/academic-years',fields:[{name:'name',label:'Academic year (e.g. 2027-28)'}]},
 policy:{title:'Create immutable policy version',path:'/policies',fields:[{name:'name'},{name:'version'},bool('nri_exempt_from_regular'),bool('allow_concurrent_enrolment')]},
 user:{title:'Create authorized user',path:'/users',fields:[{name:'name'},{name:'email',type:'email'},{name:'password',type:'password'},{name:'role',options:['institution_admin','institution_operator','aicte_admin','regional_officer','student','verifier','auditor'].map(value=>({value,label:value}))},{...institution,required:false},{name:'student_id',required:false},{name:'region',required:false}]},
 };
 forms['edit institution']={...forms.institution,title:'Edit institution',method:'PATCH',path:'/institutions/{id}',fields:[{name:'id',options:institutionOptions},...forms.institution.fields]};
 forms['edit programme']={...forms.programme,title:'Edit programme',method:'PATCH',path:'/programmes/{id}',fields:[{name:'id',options:programmeOptions},...forms.programme.fields]};
 forms['user access']={title:'Manage role and account status',method:'PATCH',path:'/users/{id}',fields:[{name:'id',options:(userList.data?.items??[]).map(u=>({value:u.id,label:u.email}))},{name:'role',options:['aicte_admin','regional_officer','institution_admin','institution_operator','student','verifier','auditor'].map(value=>({value,label:value}))},{name:'active',type:'boolean',options:[{value:'true',label:'Enabled'},{value:'false',label:'Disabled'}]}]};
 const selected=forms[tab];
 return <div className="page"><div className="page-header"><div className="page-title"><h1>Management workspace</h1><p>Authorized record creation with server-side validation, scope checks and persistent audit history.</p></div></div><div className="filter-bar">{Object.keys(forms).filter(key=>central||(['student'].includes(key)||me.data?.user.role==='institution_admin'&&['programme','edit institution','edit programme'].includes(key))).map(key=><Button key={key} variant={tab===key?'primary':'secondary'} onClick={()=>setTab(key)}>{key}</Button>)}</div>{selected&&<WorkflowForm key={tab} {...selected}/ >}{central&&tab==="institution"&&<InstitutionImport/>}</div>;
}
