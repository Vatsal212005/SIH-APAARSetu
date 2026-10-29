"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Input,Label} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Alert} from '@/components/ui/alert';
export function VerifierEntry(){const[value,setValue]=useState('');const router=useRouter();return <div className="page"><div className="page-title"><h1>Authorized verification portal</h1><p>Open a student-shared link or scan its QR. No student lookup by APAAR ID is available.</p></div><div className="card" style={{padding:24,marginTop:20,maxWidth:750}}><form onSubmit={e=>{e.preventDefault();const token=value.includes('/verify/')?value.split('/verify/')[1]:value;if(/^[A-Za-z0-9_-]{20,100}$/.test(token))router.push('/verify/'+token);}}><Label htmlFor="disclosure">Student-authorized disclosure reference</Label><Input id="disclosure" value={value} onChange={e=>setValue(e.target.value)} required/><Button style={{marginTop:14}} type="submit">Open verification</Button></form><div style={{marginTop:18}}><Alert title="Selective disclosure">The server checks the signature, issuer, consent expiration and credential revocation before returning permitted fields.</Alert></div></div></div>}
