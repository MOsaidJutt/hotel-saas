import React, { useState, useEffect, useCallback } from "react";
import {
  Info, Clock, Loader, Save, Plus, X, Eye, ChevronLeft, ChevronRight,
  Bot, FileText, Building, Hash, Wrench, BookOpen, Edit2, Trash2, Star,
} from "lucide-react";

// ─── Helpers (same api/Card/Input/Select/Btn as App.jsx, re-imported via props or duplicated here)
function api(path, opts = {}) {
  const token = localStorage.getItem("token");
  return fetch(path, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Request failed");
    return data;
  });
}
function Card({ children, className="" }) { return <div className={`bg-slate-900 border border-slate-800 rounded-xl ${className}`}>{children}</div>; }
function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>}
      <input {...props} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition" />
    </div>
  );
}
function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>}
      <select {...props} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 transition">{children}</select>
    </div>
  );
}
function Btn({ variant="primary", children, className="", ...props }) {
  const base = "px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 disabled:opacity-50";
  const vars = { primary:"bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20", secondary:"bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700" };
  return <button className={`${base} ${vars[variant]||vars.primary} ${className}`} {...props}>{children}</button>;
}
function Modal({ title, onClose, children, width="max-w-lg" }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-slate-900 border border-slate-700 rounded-2xl w-full ${width} shadow-2xl`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white text-sm">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={16}/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
const WIZARD_STEPS = [
  { id:"basic",      label:"Hotel Info",        icon:<Info size={15}/> },
  { id:"checkin",    label:"Check-in/out",      icon:<Clock size={15}/> },
  { id:"rooms",      label:"Room Types",        icon:<Building size={15}/> },
  { id:"facilities", label:"Facilities",        icon:<Building size={15}/> },
  { id:"menu",       label:"Room Service Menu", icon:<Hash size={15}/> },
  { id:"policies",   label:"Policies",          icon:<FileText size={15}/> },
  { id:"services",   label:"Extra Services",    icon:<Wrench size={15}/> },
  { id:"limits",     label:"Item Limits",       icon:<Hash size={15}/> },
  { id:"persona",    label:"Bot Persona",       icon:<Bot size={15}/> },
];

function StepCard({ title, subtitle, children, onSave, saving }) {
  return (
    <Card className="p-6">
      <div className="mb-5"><h2 className="text-base font-bold text-white">{title}</h2>{subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}</div>
      {children}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <Btn onClick={onSave} disabled={saving}>{saving ? <><Loader size={14} className="animate-spin"/>Saving…</> : <><Save size={13}/>Save This Step</>}</Btn>
      </div>
    </Card>
  );
}

function BasicInfoStep({ config, onSave, saving }) {
  const [f, setF] = useState({ hotelName:config?.hotelName||"", hotelType:config?.hotelType||"Smart Business Hotel", address:config?.address||"", city:config?.city||"", country:config?.country||"", phone:config?.phone||"", email:config?.email||"", website:config?.website||"", description:config?.description||"" });
  return (
    <StepCard title="Basic Hotel Information" subtitle="This information appears in the bot's responses about your hotel" onSave={()=>onSave(f)} saving={saving}>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Hotel Name *" value={f.hotelName} onChange={e=>setF(p=>({...p,hotelName:e.target.value}))} placeholder="Grand Luxury Hotel"/>
        <Input label="Hotel Type" value={f.hotelType} onChange={e=>setF(p=>({...p,hotelType:e.target.value}))} placeholder="Smart Business Hotel"/>
        <Input label="Address" value={f.address} onChange={e=>setF(p=>({...p,address:e.target.value}))} placeholder="123 Main Street"/>
        <Input label="City" value={f.city} onChange={e=>setF(p=>({...p,city:e.target.value}))} placeholder="Dubai"/>
        <Input label="Country" value={f.country} onChange={e=>setF(p=>({...p,country:e.target.value}))} placeholder="UAE"/>
        <Input label="Phone" value={f.phone} onChange={e=>setF(p=>({...p,phone:e.target.value}))} placeholder="+971 4 000 0000"/>
        <Input label="Email" type="email" value={f.email} onChange={e=>setF(p=>({...p,email:e.target.value}))} placeholder="info@hotel.com"/>
        <Input label="Website" value={f.website} onChange={e=>setF(p=>({...p,website:e.target.value}))} placeholder="www.hotel.com"/>
      </div>
      <div className="mt-4">
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Hotel Description</label>
        <textarea value={f.description} onChange={e=>setF(p=>({...p,description:e.target.value}))} rows={3} placeholder="A modern smart business hotel..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition resize-none"/>
      </div>
    </StepCard>
  );
}

function CheckInStep({ config, onSave, saving }) {
  const [f, setF] = useState({ checkInTime:config?.checkInTime||"2:00 PM", checkOutTime:config?.checkOutTime||"12:00 PM", earlyCheckIn:config?.earlyCheckIn||"Subject to availability", lateCheckOut:config?.lateCheckOut||"Subject to availability, may incur extra charges", receptionHours:config?.receptionHours||"24/7" });
  return (
    <StepCard title="Check-in & Check-out" subtitle="Times and policies for arrivals and departures" onSave={()=>onSave(f)} saving={saving}>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Check-in Time" value={f.checkInTime} onChange={e=>setF(p=>({...p,checkInTime:e.target.value}))} placeholder="2:00 PM"/>
        <Input label="Check-out Time" value={f.checkOutTime} onChange={e=>setF(p=>({...p,checkOutTime:e.target.value}))} placeholder="12:00 PM"/>
        <div className="col-span-2"><Input label="Early Check-in Policy" value={f.earlyCheckIn} onChange={e=>setF(p=>({...p,earlyCheckIn:e.target.value}))} placeholder="Subject to availability"/></div>
        <div className="col-span-2"><Input label="Late Check-out Policy" value={f.lateCheckOut} onChange={e=>setF(p=>({...p,lateCheckOut:e.target.value}))} placeholder="Subject to availability, may incur extra charges"/></div>
        <Input label="Reception Hours" value={f.receptionHours} onChange={e=>setF(p=>({...p,receptionHours:e.target.value}))} placeholder="24/7"/>
      </div>
    </StepCard>
  );
}

function RoomTypesStep({ config, onSave, saving }) {
  const [rooms, setRooms] = useState(config?.roomTypes?.length ? config.roomTypes : [{ name:"Standard Room", description:"", maxGuests:2, priceFrom:0, amenities:["WiFi","TV","AC"], active:true }]);
  function add()  { setRooms(r=>[...r,{name:"",description:"",maxGuests:2,priceFrom:0,amenities:[],active:true}]); }
  function del(i) { setRooms(r=>r.filter((_,j)=>j!==i)); }
  function upd(i,k,v){ setRooms(r=>{const n=[...r];n[i]={...n[i],[k]:v};return n;}); }
  return (
    <StepCard title="Room Types" subtitle="Define your room categories — the bot uses these to answer room questions" onSave={()=>onSave({roomTypes:rooms})} saving={saving}>
      <div className="space-y-3">
        {rooms.map((r,i)=>(
          <div key={i} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-white">Room Type {i+1}</p><button onClick={()=>del(i)} className="text-slate-600 hover:text-red-400"><X size={13}/></button></div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Name *" value={r.name} onChange={e=>upd(i,"name",e.target.value)} placeholder="Deluxe Room"/>
              <Input label="Max Guests" type="number" value={r.maxGuests} onChange={e=>upd(i,"maxGuests",e.target.value)}/>
              <Input label="Price From ($)" type="number" value={r.priceFrom} onChange={e=>upd(i,"priceFrom",e.target.value)}/>
            </div>
            <Input label="Description" value={r.description} onChange={e=>upd(i,"description",e.target.value)} placeholder="Spacious room with city view..."/>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Amenities <span className="text-slate-600">(comma separated)</span></label>
              <input value={(r.amenities||[]).join(", ")} onChange={e=>upd(i,"amenities",e.target.value.split(",").map(s=>s.trim()).filter(Boolean))} placeholder="WiFi, Smart TV, Mini Bar, Sea View" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"/>
            </div>
          </div>
        ))}
        <button onClick={add} className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition"><Plus size={12}/>Add Room Type</button>
      </div>
    </StepCard>
  );
}

function FacilitiesStep({ config, onSave, saving }) {
  const [items, setItems] = useState(config?.facilities?.length ? config.facilities : [{name:"Restaurant",hours:"7 AM – 11 PM",description:"",active:true},{name:"Gym",hours:"24/7",description:"",active:true},{name:"Swimming Pool",hours:"6 AM – 10 PM",description:"",active:true}]);
  function add()     { setItems(r=>[...r,{name:"",hours:"",description:"",active:true}]); }
  function del(i)    { setItems(r=>r.filter((_,j)=>j!==i)); }
  function upd(i,k,v){ setItems(r=>{const n=[...r];n[i]={...n[i],[k]:v};return n;}); }
  return (
    <StepCard title="Hotel Facilities" subtitle="Facilities available to guests — hours shown in bot responses" onSave={()=>onSave({facilities:items})} saving={saving}>
      <div className="space-y-3">
        {items.map((item,i)=>(
          <div key={i} className="grid grid-cols-[1fr,1fr,1fr,auto] gap-3 items-end bg-slate-800/40 rounded-xl p-3">
            <Input label={i===0?"Facility Name":""} value={item.name} onChange={e=>upd(i,"name",e.target.value)} placeholder="Spa & Wellness"/>
            <Input label={i===0?"Hours":""} value={item.hours} onChange={e=>upd(i,"hours",e.target.value)} placeholder="10 AM – 8 PM"/>
            <Input label={i===0?"Description":""} value={item.description} onChange={e=>upd(i,"description",e.target.value)} placeholder="Full body massages..."/>
            <button onClick={()=>del(i)} className="text-slate-600 hover:text-red-400 mb-0.5"><X size={13}/></button>
          </div>
        ))}
        <button onClick={add} className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition"><Plus size={12}/>Add Facility</button>
      </div>
    </StepCard>
  );
}

function MenuStep({ config, onSave, saving }) {
  const defaultItems = [{name:"Chicken Biryani",category:"Food",price:0,description:"",available:true},{name:"Tea",category:"Drinks",price:0,description:"",available:true},{name:"Chocolate Cake",category:"Desserts",price:0,description:"",available:true}];
  const [items, setItems] = useState(config?.menuItems?.length ? config.menuItems : defaultItems);
  const categories = ["Food","Drinks","Desserts","Snacks","Breakfast","Lunch","Dinner"];
  function add()     { setItems(r=>[...r,{name:"",category:"Food",price:0,description:"",available:true}]); }
  function del(i)    { setItems(r=>r.filter((_,j)=>j!==i)); }
  function upd(i,k,v){ setItems(r=>{const n=[...r];n[i]={...n[i],[k]:v};return n;}); }
  return (
    <StepCard title="Room Service Menu" subtitle="All items available for room service delivery" onSave={()=>onSave({menuItems:items})} saving={saving}>
      <div className="mb-3 flex justify-end"><button onClick={add} className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition"><Plus size={12}/>Add Item</button></div>
      <div className="space-y-3">
        {items.map((item,i)=>(
          <div key={i} className="grid grid-cols-[2fr,1fr,1fr,auto] gap-3 items-end bg-slate-800/40 rounded-xl p-3">
            <Input label={i===0?"Item Name":""} value={item.name} onChange={e=>upd(i,"name",e.target.value)} placeholder="Margherita Pizza"/>
            <Select label={i===0?"Category":""} value={item.category} onChange={e=>upd(i,"category",e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</Select>
            <Input label={i===0?"Price ($)":""} type="number" value={item.price} onChange={e=>upd(i,"price",e.target.value)}/>
            <button onClick={()=>del(i)} className="text-slate-600 hover:text-red-400 mb-0.5"><X size={13}/></button>
          </div>
        ))}
      </div>
    </StepCard>
  );
}

function PoliciesStep({ config, onSave, saving }) {
  const defaults = [{title:"Smoking",details:"No smoking in rooms or public areas"},{title:"Pets",details:"Pets are not permitted on the property"},{title:"Visitors",details:"Visitors must register at reception"},{title:"Quiet Hours",details:"Quiet hours observed after 10 PM"}];
  const [items, setItems] = useState(config?.policies?.length ? config.policies : defaults);
  function add()     { setItems(r=>[...r,{title:"",details:""}]); }
  function del(i)    { setItems(r=>r.filter((_,j)=>j!==i)); }
  function upd(i,k,v){ setItems(r=>{const n=[...r];n[i]={...n[i],[k]:v};return n;}); }
  return (
    <StepCard title="Hotel Policies" subtitle="Rules and policies — the bot quotes these when guests ask" onSave={()=>onSave({policies:items})} saving={saving}>
      <div className="space-y-3">
        {items.map((item,i)=>(
          <div key={i} className="grid grid-cols-[1fr,2fr,auto] gap-3 items-end bg-slate-800/40 rounded-xl p-3">
            <Input label={i===0?"Policy Title":""} value={item.title} onChange={e=>upd(i,"title",e.target.value)} placeholder="Smoking"/>
            <Input label={i===0?"Details":""} value={item.details} onChange={e=>upd(i,"details",e.target.value)} placeholder="No smoking in rooms or public areas"/>
            <button onClick={()=>del(i)} className="text-slate-600 hover:text-red-400 mb-0.5"><X size={13}/></button>
          </div>
        ))}
        <button onClick={add} className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition"><Plus size={12}/>Add Policy</button>
      </div>
    </StepCard>
  );
}

function AdditionalServicesStep({ config, onSave, saving }) {
  const defaults = [{name:"Wake-up Call",description:"",available:true},{name:"Doctor on Call",description:"",available:true},{name:"Currency Exchange",description:"",available:true},{name:"Printing & Photocopy",description:"",available:true}];
  const [items, setItems] = useState(config?.additionalServices?.length ? config.additionalServices : defaults);
  function add()     { setItems(r=>[...r,{name:"",description:"",available:true}]); }
  function del(i)    { setItems(r=>r.filter((_,j)=>j!==i)); }
  function upd(i,k,v){ setItems(r=>{const n=[...r];n[i]={...n[i],[k]:v};return n;}); }
  return (
    <StepCard title="Additional Services" subtitle="Extra services your hotel provides" onSave={()=>onSave({additionalServices:items})} saving={saving}>
      <div className="space-y-3">
        {items.map((item,i)=>(
          <div key={i} className="grid grid-cols-[2fr,3fr,auto,auto] gap-3 items-end bg-slate-800/40 rounded-xl p-3">
            <Input label={i===0?"Service Name":""} value={item.name} onChange={e=>upd(i,"name",e.target.value)} placeholder="Babysitting"/>
            <Input label={i===0?"Description":""} value={item.description||""} onChange={e=>upd(i,"description",e.target.value)} placeholder="Available on request..."/>
            <div>{i===0&&<label className="block text-xs font-medium text-slate-400 mb-1.5">Active</label>}<input type="checkbox" checked={item.available} onChange={e=>upd(i,"available",e.target.checked)} className="accent-emerald-500 w-4 h-4"/></div>
            <button onClick={()=>del(i)} className="text-slate-600 hover:text-red-400 mb-0.5"><X size={13}/></button>
          </div>
        ))}
        <button onClick={add} className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition"><Plus size={12}/>Add Service</button>
      </div>
    </StepCard>
  );
}

function ItemLimitsStep({ config, onSave, saving }) {
  const roomNames = config?.roomTypes?.map(r=>r.name)||["Standard Room","Deluxe Room","Executive Suite","Family Suite"];
  const [limits, setLimits] = useState(config?.itemLimits?.length ? config.itemLimits : roomNames.map(name=>({roomType:name,pillows:2,towels:2,toiletries:1,bedsheets:1})));
  function upd(i,k,v){ setLimits(r=>{const n=[...r];n[i]={...n[i],[k]:parseInt(v)||0};return n;}); }
  return (
    <StepCard title="Housekeeping Item Limits" subtitle="Maximum extra items per request, per room type — prevents misuse" onSave={()=>onSave({itemLimits:limits})} saving={saving}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 text-slate-600 text-[11px] uppercase tracking-wider">{["Room Type","Pillows","Towels","Toiletry Sets","Bedsheet Changes"].map(h=><th key={h} className="py-3 px-2 text-left font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-800/60">
            {limits.map((l,i)=>(
              <tr key={i}>
                <td className="py-3 text-white text-xs font-medium">{l.roomType}</td>
                {["pillows","towels","toiletries","bedsheets"].map(field=>(
                  <td key={field} className="py-3 px-2">
                    <input type="number" min={0} max={20} value={l[field]} onChange={e=>upd(i,field,e.target.value)} className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-emerald-500/60"/>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StepCard>
  );
}

function PersonaStep({ config, onSave, saving }) {
  const [f, setF] = useState({ botName:config?.botName||"Alex", botRole:config?.botRole||"Senior Front Desk Executive", botVoice:config?.botVoice||"Calm, warm, confident, occasionally light-hearted", botLanguage:config?.botLanguage||"English", customGreeting:config?.customGreeting||"", customInstructions:config?.customInstructions||"" });
  return (
    <StepCard title="Bot Persona" subtitle="Defines how the AI presents itself and speaks to guests" onSave={()=>onSave(f)} saving={saving}>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Bot Name" value={f.botName} onChange={e=>setF(p=>({...p,botName:e.target.value}))} placeholder="Alex"/>
        <Input label="Bot Role / Title" value={f.botRole} onChange={e=>setF(p=>({...p,botRole:e.target.value}))} placeholder="Senior Front Desk Executive"/>
        <div className="col-span-2"><Input label="Voice / Tone" value={f.botVoice} onChange={e=>setF(p=>({...p,botVoice:e.target.value}))} placeholder="Calm, warm, confident..."/></div>
        <Input label="Primary Language" value={f.botLanguage} onChange={e=>setF(p=>({...p,botLanguage:e.target.value}))} placeholder="English"/>
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Custom Welcome Message <span className="text-slate-600">(optional)</span></label>
          <textarea value={f.customGreeting} onChange={e=>setF(p=>({...p,customGreeting:e.target.value}))} rows={2} placeholder="Welcome to Grand Luxury Hotel! I'm Alex..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition resize-none"/>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Additional Instructions <span className="text-slate-600">(optional — extra rules for the AI)</span></label>
          <textarea value={f.customInstructions} onChange={e=>setF(p=>({...p,customInstructions:e.target.value}))} rows={4} placeholder="Always recommend our spa when guests mention stress..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition resize-none"/>
        </div>
      </div>
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export function BotSetupWizard() {
  const [step, setStep]       = useState(0);
  const [config, setConfig]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [err, setErr]         = useState("");
  const [preview, setPreview] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(()=>{ api("/api/botconfig").then(d=>{setConfig(d);setLoading(false);}).catch(()=>setLoading(false)); },[]);

  async function save(endpoint, body) {
    setSaving(true); setSaved(false); setErr("");
    try {
      await api(`/api/botconfig/${endpoint}`,{method:"PUT",body});
      const fresh = await api("/api/botconfig");
      setConfig(fresh); setSaved(true); setTimeout(()=>setSaved(false),2000);
    } catch(e){ setErr(e.message); }
    setSaving(false);
  }

  async function loadPreview() {
    const d = await api("/api/botconfig/prompt-preview");
    setPreview(d.prompt); setShowPreview(true);
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500"><Loader size={22} className="animate-spin mr-2"/>Loading configuration…</div>;

  return (
    <div className="flex gap-6">
      <div className="w-52 shrink-0">
        <Card className="p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-2 mb-3">Setup Steps</p>
          <div className="space-y-0.5">
            {WIZARD_STEPS.map((s,i)=>(
              <button key={s.id} onClick={()=>setStep(i)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium text-left transition ${i===step?"bg-emerald-500/10 text-emerald-400 border border-emerald-500/20":"text-slate-500 hover:text-slate-200 hover:bg-slate-800/60"}`}>
                <span className={i===step?"text-emerald-400":"text-slate-600"}>{s.icon}</span><span>{s.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800">
            <button onClick={loadPreview} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-violet-400 hover:bg-violet-500/10 border border-violet-500/20 transition font-medium"><Eye size={12}/>Preview Prompt</button>
          </div>
        </Card>
      </div>

      <div className="flex-1 min-w-0">
        {err  && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{err}</p>}
        {saved && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4">✓ Saved successfully</p>}

        {step===0 && <BasicInfoStep config={config} onSave={b=>save("basic",b)} saving={saving}/>}
        {step===1 && <CheckInStep config={config} onSave={b=>save("checkin",b)} saving={saving}/>}
        {step===2 && <RoomTypesStep config={config} onSave={b=>save("rooms",b)} saving={saving}/>}
        {step===3 && <FacilitiesStep config={config} onSave={b=>save("facilities",b)} saving={saving}/>}
        {step===4 && <MenuStep config={config} onSave={b=>save("menu",b)} saving={saving}/>}
        {step===5 && <PoliciesStep config={config} onSave={b=>save("policies",b)} saving={saving}/>}
        {step===6 && <AdditionalServicesStep config={config} onSave={b=>save("services",b)} saving={saving}/>}
        {step===7 && <ItemLimitsStep config={config} onSave={b=>save("limits",b)} saving={saving}/>}
        {step===8 && <PersonaStep config={config} onSave={b=>save("persona",b)} saving={saving}/>}

        <div className="flex justify-between mt-6">
          <Btn variant="secondary" onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0}><ChevronLeft size={14}/>Back</Btn>
          <Btn onClick={()=>setStep(s=>Math.min(WIZARD_STEPS.length-1,s+1))} disabled={step===WIZARD_STEPS.length-1}>Next<ChevronRight size={14}/></Btn>
        </div>
      </div>

      {showPreview && (
        <Modal title="System Prompt Preview" onClose={()=>setShowPreview(false)} width="max-w-3xl">
          <div className="bg-slate-800 rounded-xl p-4 max-h-[60vh] overflow-y-auto">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{preview}</pre>
          </div>
          <p className="text-xs text-slate-500 mt-3">{preview.length.toLocaleString()} characters — this is exactly what the AI receives</p>
        </Modal>
      )}
    </div>
  );
}
