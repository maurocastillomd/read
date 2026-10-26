import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerAuth} from '../build/owner-auth.ts';

const limiter=(allowed)=>{let calls=0;return {get calls(){return calls;},async limit(){calls++;return {success:calls<=allowed};}};};
const post=(password)=>new Request('https://read.example/signin',{method:'POST',body:new URLSearchParams({password})});
const env=(extra={})=>({SESSION_SECRET:'test-secret',READ_PASSWORD:'correct horse',...extra});

test('the right password signs in with a secure, http-only session cookie',async()=>{
  const response=await ownerAuth(post('correct horse'),env());
  assert.equal(response.status,303);
  assert.match(response.headers.get('set-cookie'),/^read_session=.+; HttpOnly; Secure; SameSite=Lax$/);
});

test('sign-in attempts past the limit are refused before the password is checked',async()=>{
  const SIGN_IN_LIMIT=limiter(1);
  assert.equal((await ownerAuth(post('wrong'),env({SIGN_IN_LIMIT}))).status,401);
  const blocked=await ownerAuth(post('correct horse'),env({SIGN_IN_LIMIT}));
  assert.equal(blocked.status,429);
  assert.equal(blocked.headers.get('set-cookie'),null);
  assert.equal(SIGN_IN_LIMIT.calls,2);
});

test('forged identity headers never reach the app without a session',async()=>{
  const request=new Request('https://read.example/api/books',{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'x@y.z'}});
  const passed=await ownerAuth(request,env());
  assert.ok(passed instanceof Request);
  assert.equal(passed.headers.get('oai-authenticated-user-id'),null);
});
