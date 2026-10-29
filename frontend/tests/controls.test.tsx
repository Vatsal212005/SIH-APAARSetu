import {describe,it,expect} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {Button} from '../components/ui/button';
import {statusTone} from '../components/ui/badge';
import {Alert} from '../components/ui/alert';
describe('record workflow controls',()=>{
 it('prevents duplicate submission when disabled',()=>{render(<Button disabled>Submitting</Button>);expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);cleanup();});
 it('distinguishes rejected and accepted records',()=>{expect(statusTone('rejected')).toBe('red');expect(statusTone('accepted')).toBe('green');});
 it('exposes corrective error details',()=>{render(<Alert title="Import failed" tone="danger">Admission date must be YYYY-MM-DD</Alert>);expect(screen.getByText('Admission date must be YYYY-MM-DD')).toBeTruthy();cleanup();});
});
