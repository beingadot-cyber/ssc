const {neon}=require('@neondatabase/serverless'),bc=require('bcryptjs'),cr=require('crypto');
const db=neon(process.env.DATABASE_URL),q=(t,p=[])=>db.query(t,p),SEC=process.env.SECRET||'change-me';
const E=(c,m)=>Object.assign(new Error(m),{c});
const hm=b=>cr.createHmac('sha256',SEC).update(b).digest('base64url');
const sign=o=>{const b=Buffer.from(JSON.stringify({...o,e:Date.now()+6048e5})).toString('base64url');return b+'.'+hm(b)};
const ver=t=>{if(!t)return;const[b,s]=t.split('.');if(!s||s!==hm(b))return;const o=JSON.parse(Buffer.from(b,'base64url'));if(o.e>Date.now())return o};
const ck=(r,n)=>((r.headers.cookie||'').match(new RegExp('(?:^|; )'+n+'=([^;]*)'))||[])[1];
const KEYS=['whatsapp','upi','instagram','phone','email','address','shipping','about','pol_shipping','pol_return','pol_privacy','pol_terms'];
const PR=[['Handcrafted Diya Thali',175],['Peacock Shubh Labh Hanging',175],['Floral Shubh Labh Hanging Set',200],['Blue Evil Eye Hanging Décor',399],['Lotus & Pearl Shubh Labh Hanging Set',250],['Peacock Floral Tea Light Holder',450],['Pink Floral Mirror Work Toran',899],['Double Peacock Shubh Labh Hanging',399],['Blue Floral Shubh Labh Hanging Set',375],['Pink Floral Tea Light Holder Pair',175],['Maroon & White Floral Festive Toran',1100],['Festive Table Runner & Diya Holder Set',450],['Square Diya / Pooja Thali',175],['Peacock & Pearl Shubh Labh Toran',1100],['Lotus, Pearl & Bell Toran',1100]];
const T={coupons:['code','kind','value','min_order','active'],products:['code','name','description','price','mrp','image_url','category','stock','is_active','is_featured','is_bestseller'],media:['type','src','pos','active'],testimonials:['name','body','active']};
let ready;
const init=()=>ready||(ready=(async()=>{
for(const s of[
`create table if not exists customers(id serial primary key,mobile text unique,country_code text default '+91',password_hash text,mobile_verified bool default true,account_status text default 'Active',created_at timestamptz default now(),last_login timestamptz)`,
`create table if not exists admins(id serial primary key,username text unique,password_hash text,role text default 'admin',created_at timestamptz default now())`,
`create table if not exists products(id serial primary key,code text unique,name text,description text default '',price int,mrp int,image_url text default '',category text default '',stock int default 10,is_active bool default true,is_featured bool default false,is_bestseller bool default false,created_at timestamptz default now(),updated_at timestamptz default now())`,
`create table if not exists orders(id serial primary key,customer_id int references customers(id),name text,mobile text,address text,total int,shipping int,payment_status text default 'Pending',order_status text default 'Pending',created_at timestamptz default now())`,
`create table if not exists order_items(order_id int references orders(id),product_id int,name text,code text,price int,qty int)`,
`create table if not exists media(id serial primary key,type text,src text,pos int default 0,active bool default true)`,
`create table if not exists testimonials(id serial primary key,name text,body text,active bool default true)`,
`create table if not exists settings(k text primary key,v text)`,
`create table if not exists otps(mobile text,hash text,ts timestamptz default now())`,
`create table if not exists images(id serial primary key,mime text,data text)`,
`create table if not exists rl(k text,ts timestamptz default now())`,
`create table if not exists coupons(id serial primary key,code text unique,kind text default 'percent',value int default 0,min_order int default 0,active bool default true)`,
`alter table orders add column if not exists discount int default 0`,`alter table orders add column if not exists coupon text`])await q(s);
await q(`insert into settings(k,v) values ${KEYS.map((_,i)=>`($${i+1},'')`)} on conflict do nothing`,KEYS);
if(!(await q('select 1 from products limit 1')).length)for(const[i,[n,p]]of PR.entries())await q('insert into products(code,name,price,description) values($1,$2,$3,$4)',['SSC-'+String(i+1).padStart(3,'0'),n,p,i==9?'Sold as a pair (2 pieces).':'']);
if(!(await q(`select 1 from settings where k='mrp_seeded'`)).length){await q(`update products set mrp=round(price*(1.25+random()*0.1)/5)*5 where mrp is null`);await q(`insert into settings(k,v) values('mrp_seeded','1')`)}
if(process.env.ADMIN_USER&&!(await q('select 1 from admins limit 1')).length)await q('insert into admins(username,password_hash) values($1,$2)',[process.env.ADMIN_USER,await bc.hash(process.env.ADMIN_PASS,10)]);
})());
const rl=async(k,n)=>{await q(`delete from rl where ts<now()-interval '15 minutes'`);const[{c}]=await q('select count(*)::int c from rl where k=$1',[k]);if(c>=n)throw E(429,'Too many attempts. Try again in a few minutes.');await q('insert into rl(k) values($1)',[k])};
const vm=(m,pw)=>{if(!/^[6-9]\d{9}$/.test(m||''))throw E(400,'Enter a valid 10-digit mobile number.');if(pw!==undefined&&!(typeof pw=='string'&&pw.length>=8&&/[a-z]/i.test(pw)&&/\d/.test(pw)))throw E(400,'Password needs 8+ characters with letters and numbers.')};
const STATS=`select (select count(*)::int from products) tp,(select count(*)::int from products where is_active) ap,(select count(*)::int from products where stock<=0) oos,(select count(*)::int from customers) cu,(select count(*)::int from orders) o,(select count(*)::int from orders where order_status='Pending') po,(select count(*)::int from orders where order_status='Confirmed') co,(select count(*)::int from orders where order_status='Delivered') d,(select coalesce(sum(total),0)::int from orders where payment_status='Paid') rev`;
const LIST={coupons:'select * from coupons order by id',products:'select * from products order by id',media:'select * from media order by pos,id',testimonials:'select * from testimonials order by id',customers:`select c.id,mobile,mobile_verified,created_at,last_login,account_status,(select count(*)::int from orders o where o.customer_id=c.id) orders from customers c order by id desc`,orders:`select o.*,coalesce((select json_agg(json_build_object('code',code,'name',name,'price',price,'qty',qty)) from order_items i where i.order_id=o.id),'[]'::json) items from orders o order by id desc`};
const cartOf=async items=>{if(!Array.isArray(items)||!items.length)throw E(400,'Cart is empty.');const rows=await q('select * from products where is_active and code=any($1)',[items.map(i=>String(i.code))]);let sub=0;const L=items.map(i=>{const p=rows.find(x=>x.code===i.code),n=Math.max(1,Math.min(+i.qty|0,99));if(!p||p.stock<n)throw E(400,'Not available: '+i.code);sub+=p.price*n;return[p,n]});return{L,sub}};
const disc=async(code,sub)=>{if(!code)return[0,null];const[c]=await q('select * from coupons where active and upper(code)=upper($1)',[String(code).trim()]);if(!c)throw E(400,'Invalid coupon code.');if(sub<(c.min_order||0))throw E(400,`Minimum order of ₹${c.min_order} required for this coupon.`);return[Math.min(c.kind==='flat'?c.value:Math.floor(sub*c.value/100),sub),c.code]};
module.exports=async(req,res)=>{
const J=(o,c=200)=>res.status(c).json(o);
try{await init();
const P=new URL(req.url,'http://x').pathname.split('/').slice(2),r=P[0],b=req.body&&typeof req.body=='object'?req.body:{},ip=(req.headers['x-forwarded-for']||'').split(',')[0],me=ver(ck(req,'ssc')),ad=ver(ck(req,'ssa'));
const setc=(n,v,age=604800)=>res.setHeader('Set-Cookie',[...(res.getHeader('Set-Cookie')||[]),`${n}=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`]);
const login=async c=>{await q('update customers set last_login=now() where id=$1',[c.id]);setc('ssc',sign({id:c.id,m:c.mobile}));return J({me:{m:c.mobile}})};
if(r==='img'){const[i]=await q('select mime,data from images where id=$1',[+P[1]]);if(!i)return res.status(404).end();res.setHeader('Content-Type',i.mime);res.setHeader('Cache-Control','public,max-age=31536000,immutable');return res.send(Buffer.from(i.data,'base64'))}
if(r==='boot'){const[st,pr,md,te]=await Promise.all([q('select * from settings'),q('select code,name,description,price,mrp,image_url,category,stock,is_featured,is_bestseller from products where is_active order by id'),q('select id,type,src from media where active order by pos,id'),q('select name,body from testimonials where active order by id')]);return J({settings:Object.fromEntries(st.map(x=>[x.k,x.v])),products:pr,media:md,testimonials:te,me:me?{m:me.m}:null})}
if(r==='auth'){const{mobile:m,password:pw,signup}=b;vm(m,pw);const[c]=await q('select * from customers where mobile=$1',[m]);
if(c){if(signup)throw E(409,'This mobile number is already registered. Please log in.');await rl('l'+m,8);await rl('li'+ip,20);
if(c.account_status!=='Active')throw E(403,'This account is disabled.');
if(!c.password_hash){await q('update customers set password_hash=$1 where id=$2',[await bc.hash(pw,10),c.id]);return login(c)}
if(!await bc.compare(pw,c.password_hash))throw E(401,'Invalid mobile number or password.');return login(c)}
await rl('s'+ip,10);const[n]=await q('insert into customers(mobile,password_hash) values($1,$2) returning *',[m,await bc.hash(pw,10)]);return login(n)}
if(r==='logout'){setc('ssc','',0);return J({ok:1})}
if(r==='orders'){if(!me)throw E(401,'Login required');return J(await q(`select o.id,o.total,o.payment_status,o.order_status,o.created_at,(select json_agg(json_build_object('code',code,'name',name,'qty',qty)) from order_items i where i.order_id=o.id) items from orders o where customer_id=$1 order by id desc`,[me.id]))}
if(r==='coupon'){if(!String(b.code||'').trim())throw E(400,'Enter a coupon code.');const{sub}=await cartOf(b.items),[d,code]=await disc(b.code,sub);return J({discount:d,code})}
if(r==='order'){await rl('or'+ip,15);const{name,mobile,address,city,state,pin,items,coupon}=b;vm(mobile);
if(!name||!address||!city||!state||!/^\d{6}$/.test(pin||''))throw E(400,'Please fill all delivery details correctly.');
const{L,sub}=await cartOf(items),[d,code]=await disc(coupon,sub);
const[{v}]=await q(`select coalesce(nullif(v,''),'0') v from settings where k='shipping'`),sh=+v||0,tot=sub-d+sh;
const[o]=await q('insert into orders(customer_id,name,mobile,address,total,shipping,discount,coupon) values($1,$2,$3,$4,$5,$6,$7,$8) returning id',[me?.id||null,name.slice(0,100),mobile,`${address}, ${city}, ${state} - ${pin}`.slice(0,500),tot,sh,d,code]);
for(const[p,n]of L){await q('insert into order_items values($1,$2,$3,$4,$5,$6)',[o.id,p.id,p.name,p.code,p.price,n]);await q('update products set stock=greatest(stock-$1,0) where id=$2',[n,p.id])}
return J({id:o.id,total:tot})}
if(r==='paid'){await q(`update orders set payment_status='Awaiting Verification' where id=$1 and mobile=$2 and payment_status='Pending'`,[+b.id,String(b.mobile)]);return J({ok:1})}
if(r==='alogin'){await rl('a'+ip,10);const[a]=await q('select * from admins where username=$1',[b.u]);if(!a||!await bc.compare(b.p||'',a.password_hash))throw E(401,'Invalid credentials');setc('ssa',sign({a:a.id}));return J({ok:1})}
if(r==='alogout'){setc('ssa','',0);return J({ok:1})}
if(r==='a'){if(!ad)throw E(401,'Admin login required');const s=P[1],t=P[2];
if(s==='stats')return J((await q(STATS))[0]);
if(s==='list'){if(!LIST[t])throw E(404,'Not found');return J(await q(LIST[t]))}
if(s==='save'){if(!T[t])throw E(404,'Not found');const k=T[t].filter(c=>c in b),v=k.map(c=>b[c]===''?null:b[c]);
if(b.id)await q(`update ${t} set ${k.map((c,i)=>c+'=$'+(i+1))}${t==='products'?',updated_at=now()':''} where id=$${k.length+1}`,[...v,b.id]);
else await q(`insert into ${t}(${k}) values(${k.map((_,i)=>'$'+(i+1))})`,v);return J({ok:1})}
if(s==='del'){if(!T[t])throw E(404,'Not found');await q(t==='products'?'update products set is_active=false where id=$1':`delete from ${t} where id=$1`,[b.id]);return J({ok:1})}
if(s==='img'){if(!/^image\/(jpeg|png|webp)$/.test(b.mime)||!b.data||b.data.length>3e6)throw E(400,'Invalid image');const[i]=await q('insert into images(mime,data) values($1,$2) returning id',[b.mime,b.data]);return J({url:'/api/img/'+i.id})}
if(s==='settings'){for(const k of KEYS)if(k in b)await q('insert into settings(k,v) values($1,$2) on conflict(k) do update set v=$2',[k,String(b[k])]);return J({ok:1})}
if(s==='order'){await q('update orders set payment_status=$1,order_status=$2 where id=$3',[b.payment_status,b.order_status,b.id]);return J({ok:1})}
if(s==='cust'){await q(b.reset?'update customers set password_hash=null where id=$1':'update customers set account_status=$2 where id=$1',b.reset?[b.id]:[b.id,b.status==='Disabled'?'Disabled':'Active']);return J({ok:1})}}
throw E(404,'Not found')
}catch(e){if(!e.c)console.error(e);J({error:e.c?e.message:'Server error'},e.c||500)}};
