import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {WorkflowForm} from '../features/management';
import {api} from '../lib/api';
vi.mock('../lib/api',()=>({api:vi.fn().mockResolvedValue({id:'saved-record'})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
function Wrapper({children}:{children:React.ReactNode}){return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider>}
describe('workflow form data readiness',()=>{
 it('blocks submission until required dropdown data arrives',()=>{render(<WorkflowForm title="Issue" path="/credentials/issue" fields={[{name:'enrolment_id',options:[]}]}/>,{wrapper:Wrapper});expect((screen.getByRole('button',{name:'Save record'}) as HTMLButtonElement).disabled).toBe(true);});
 it('submits the selected default record identifier',async()=>{render(<WorkflowForm title="Issue" path="/credentials/issue" fields={[{name:'enrolment_id',options:[{value:'source-123',label:'Synthetic eligible student'}]}]}/>,{wrapper:Wrapper});fireEvent.click(screen.getByRole('button',{name:'Save record'}));await waitFor(()=>expect(api).toHaveBeenCalledWith('/credentials/issue',expect.objectContaining({body:JSON.stringify({enrolment_id:'source-123'})})));});
 it('shows server-side business validation failures',async()=>{vi.mocked(api).mockRejectedValueOnce(new Error('Intake approval is required'));render(<WorkflowForm title="Register" path="/students" fields={[{name:'full_name'}]}/>,{wrapper:Wrapper});fireEvent.change(screen.getByLabelText('full name'),{target:{value:'Synthetic Applicant'}});fireEvent.click(screen.getByRole('button',{name:'Save record'}));await waitFor(()=>expect(screen.getByText('Intake approval is required')).toBeTruthy());});
});
