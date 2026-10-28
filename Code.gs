// Southern Concrete Coatings — Google Apps Script backend.
// Paste this whole file into script.google.com, then Deploy > New deployment > Web app.
// Execute as: Me. Who has access: Anyone.
// Run setup() once from the editor and approve Drive and Gmail.
//
// TEST_MODE below is the server copy of the single flag in config.js. It is false (live).
// While it is true, every MailApp send is forced to TEST_TO. There is no other send path.
// No API keys or passwords belong in this file. Gmail and Drive use the Google account you deploy with.

/* Quote rewriter, per-sq-ft math, and email copy.
   Shared by the browser app and Code.gs (Apps Script).
   No DOM, no secrets. */
function round2(n){return Math.round(Number(n)*100)/100;}
function money(v){
  if(v==null||v===''||isNaN(Number(v)))return '';
  return '$'+Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function validEmail(e){return /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(String(e||'').trim());}
function formatSq(n){
  var r=Math.round(Number(n)*10)/10;
  return r.toLocaleString('en-US',{maximumFractionDigits:1});
}
function rwTitle(s){
  return String(s||'').replace(/\b[a-z]/g,function(c){return c.toUpperCase();})
    .replace(/\b(And|Of|The|By|To|In|On|At|With|A|For)\b/g,function(w,x,i){return i?w.toLowerCase():w;});
}
function rwSentence(s){
  s=String(s||'').replace(/\s+/g,' ').trim();
  if(!s)return '';
  s=s.charAt(0).toUpperCase()+s.slice(1);
  return /[.!?]$/.test(s)?s:s+'.';
}

/* Where an email is allowed to go. Test mode never returns the customer. */
function deliveryAddress(testMode,testTo,customerEmail,businessEmail){
  if(testMode){
    if(!testTo)throw new Error('Test mode is on but TEST_TO is empty.');
    return {to:testTo,replyTo:testTo};
  }
  return {to:String(customerEmail||'').trim(),replyTo:businessEmail};
}

var AREAS=[
  [/\bgarage\b/,'Garage Floor'],
  [/\bpool\s*deck\b/,'Pool Deck'],
  [/\bpatio\b/,'Patio'],
  [/\bporch\b/,'Porch'],
  [/\blanai\b|\bscreen(?:ed)?\s+porch\b/,'Lanai'],
  [/\bwalkway\b|\bsidewalk\b/,'Walkway'],
  [/\bkitchen\b/,'Commercial Kitchen'],
  [/\bwarehouse\b|\bindustrial\b/,'Warehouse Floor'],
  [/\bshowroom\b|\bretail\b|\bcommercial\b/,'Commercial Floor'],
  [/\bbasement\b/,'Basement Floor'],
  [/\bdriveway\b/,'Driveway'],
  [/\bbreezeway\b/,'Breezeway']
];
var Q_SYSTEMS=[
  [/\bpolyaspartic\b/,'Polyaspartic'],
  [/\bpolyurea\b/,'Polyurea'],
  [/\bmetallic(?:\s+epoxy)?\b/,'Metallic Epoxy'],
  [/\bquartz\b/,'Quartz Broadcast'],
  [/\b(?:full[-\s]?broadcast|flake|vinyl\s*chip|chip\s*system)\b/,'Flake System'],
  [/\bsolid(?:\s+color)?\s+epoxy\b|\bepoxy\b/,'Epoxy'],
  [/\bseal(?:er|ing)?\b/,'Concrete Sealer'],
  [/\bgrind(?:ing)?\b|\bprep\b/,'Concrete Prep']
];
var PREPS=[
  [/\bdiamond\s*grind|\bgrind/,'Diamond Grinding'],
  [/\bcrack/,'Crack Repair'],
  [/\bspall|\bpatch/,'Spall Repair'],
  [/\bmoisture|\bvapor|\bmvt\b/,'Moisture Mitigation'],
  [/\boil\b/,'Oil Stain Treatment'],
  [/\bjoint/,'Joint Fill'],
  [/\bshot\s*blast/,'Shot Blast'],
  [/\bcoating\s*removal|\bstrip(?:ping)?\b/,'Coating Removal']
];

function firstLabel(t,list){
  for(var i=0;i<list.length;i++)if(list[i][0].test(t))return list[i][1];
  return '';
}
function allLabels(t,list){
  var out=[];
  for(var i=0;i<list.length;i++)if(list[i][0].test(t)&&out.indexOf(list[i][1])<0)out.push(list[i][1]);
  return out;
}
function parseSqft(raw){
  var m=String(raw||'').match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*-?\s*ft|sqft|square\s*feet|sq\.?\s*feet|\bsf\b)/i);
  return m?parseFloat(m[1].replace(/,/g,'')):null;
}
function parseRate(raw){
  var s=String(raw||'');
  var patterns=[
    /\$\s*(\d+(?:\.\d{1,2})?)\s*(?:per|a|an|\/)\s*(?:sq\.?\s*ft|sqft|square\s*foot|sf)\b/i,
    /(\d+(?:\.\d{1,2})?)\s*(?:dollars|bucks)\s*(?:per|a|an|\/)\s*(?:sq\.?\s*ft|sqft|square\s*foot|sf)\b/i,
    /\$\s*(\d+(?:\.\d{1,2})?)\s*\/\s*(?:sq\.?\s*ft|sqft|sf)\b/i,
    /\$\s*(\d+(?:\.\d{1,2})?)\s*psf\b/i,
    /(\d+(?:\.\d{1,2})?)\s*(?:a|per)\s*(?:sq\.?\s*ft|sqft|square\s*foot|sf)\b/i
  ];
  for(var i=0;i<patterns.length;i++){
    var m=s.match(patterns[i]);
    if(m)return parseFloat(m[1]);
  }
  return null;
}
function parseLump(raw){
  var s=String(raw||'')
    .replace(/\$\s*\d+(?:\.\d{1,2})?\s*(?:per|a|an|\/)\s*(?:sq\.?\s*ft|sqft|square\s*foot|sf)\b/ig,' ')
    .replace(/\$\s*\d+(?:\.\d{1,2})?\s*\/\s*(?:sq\.?\s*ft|sqft|sf)\b/ig,' ')
    .replace(/\$\s*\d+(?:\.\d{1,2})?\s*psf\b/ig,' ')
    .replace(/\d+(?:\.\d{1,2})?\s*(?:dollars|bucks)\s*(?:per|a|an|\/)\s*(?:sq\.?\s*ft|sqft|square\s*foot|sf)\b/ig,' ');
  var m=s.match(/\$\s*(\d[\d,]*(?:\.\d{1,2})?)\s*k?\b/i)||s.match(/(?:^|\s)(\d[\d,]{2,}(?:\.\d{1,2})?)\s*(?:dollars|bucks)\b/i);
  if(!m)return null;
  var v=parseFloat(m[1].replace(/,/g,''));
  if(/k\b/i.test(m[0])&&v<1000)v*=1000;
  return v;
}
function splitQuote(raw){
  return String(raw||'').split(/\n|;|\+(?!\s*\d)|\band then\b|\balso\b|\band\s+(?=the\s+)?(?=(?:the\s+)?(?:patio|garage|pool|porch|basement|warehouse|kitchen|driveway|lanai|walkway|breezeway|showroom)\b)/i)
    .map(function(s){return s.trim();})
    .filter(function(s){return s.length>1;});
}
function rwItem(raw){
  var sqft=parseSqft(raw),rate=parseRate(raw),lump=parseLump(raw);
  var t=String(raw||'').toLowerCase().replace(/\s+/g,' ').trim();
  var area=firstLabel(t,AREAS),system=firstLabel(t,Q_SYSTEMS),preps=allLabels(t,PREPS);
  var title=[area,system].filter(Boolean).join(' ');
  if(!title&&preps.length)title=preps.join(' & ');
  if(!title)title=rwTitle(t.replace(/[.]+$/,''))||'Concrete Coating';
  if(sqft)title+=' — '+formatSq(sqft)+' sq ft';
  var price=null;
  if(sqft&&rate)price=round2(sqft*rate);
  else if(lump!=null)price=lump;
  var detail=rwSentence(raw);
  if(sqft&&rate)detail=(detail?detail+' ':'')+formatSq(sqft)+' sq ft at '+money(rate)+' per sq ft.';
  var extra=preps.filter(function(p){return title.indexOf(p)<0;});
  if(extra.length)detail='Prep: '+extra.join(', ')+'. '+detail;
  return {title:title,detail:detail.trim(),price:price};
}
function rewriteQuote(raw){
  return splitQuote(raw).map(rwItem);
}
function numOrNull(v){
  if(v==null||v==='')return null;
  var n=Number(String(v).replace(/[$,]/g,''));
  return isNaN(n)?null:n;
}
function buildItems(fields,spoken){
  fields=fields||{};
  var items=[];
  var system=String(fields.system||'').trim();
  var color=String(fields.color||'').trim();
  var prep=String(fields.prep||'').trim();
  var cure=String(fields.cure||'').trim();
  var sqft=numOrNull(fields.sqft);
  var rate=numOrNull(fields.rate);
  if(system||color||prep||cure||sqft||rate){
    var title=system||'Concrete Coating';
    if(sqft)title+=' — '+formatSq(sqft)+' sq ft';
    var bits=[];
    if(color)bits.push('Color / flake: '+color+'.');
    if(prep)bits.push('Prep: '+prep+'.');
    if(cure)bits.push('Return to service: '+cure+'.');
    if(sqft&&rate)bits.push(formatSq(sqft)+' sq ft at '+money(rate)+' per sq ft.');
    else if(rate)bits.push('Rate: '+money(rate)+' per sq ft.');
    else if(sqft)bits.push(formatSq(sqft)+' sq ft.');
    items.push({title:title,detail:bits.join(' '),price:(sqft&&rate)?round2(sqft*rate):null});
  }
  rewriteQuote(spoken).forEach(function(it){if(it.title)items.push(it);});
  return items;
}
function totalOf(items){
  return round2((items||[]).reduce(function(a,i){return a+(Number(i.price)||0);},0));
}

function escHtml(s){
  return String(s==null?'':s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
  });
}
/* Owner-only fields. Never copy these into a customer email, PDF, or answer page. */
function customerJob(j){
  var o;
  try { o = JSON.parse(JSON.stringify(j||{})); } catch (e) { o = {}; }
  delete o.hardness;
  delete o.hardnessHow;
  delete o.internalNotes;
  delete o.aiNote;
  delete o.phone2;
  delete o.contact2;
  delete o.callAnswers;
  delete o.smsReminded;
  if (Array.isArray(o.items)) {
    var vis = o.items.filter(function (it) { return !(it && it.internal); });
    if (vis.length !== o.items.length) {
      o.items = vis;
      o.total = totalOf(vis);
    }
  }
  return o;
}
function defaultForm() {
  return {
    systems: [
      { name: 'Garage floor flake system', rate: '' },
      { name: 'Full Flake Broadcast System', rate: '' },
      { name: 'Acid Stain and Seal', rate: '' },
      { name: 'Grind and Seal', rate: '' },
      { name: 'Metallic epoxy', rate: '' },
      { name: 'Solid color epoxy', rate: '' },
      { name: 'Polyaspartic system', rate: '' },
      { name: 'Polyurea garage system', rate: '' },
      { name: 'Quartz broadcast', rate: '' },
      { name: 'Pool deck coating', rate: '' },
      { name: 'Patio and porch coating', rate: '' },
      { name: 'Commercial kitchen floor', rate: '' },
      { name: 'Warehouse / industrial floor', rate: '' },
      { name: 'Concrete sealing', rate: '' },
      { name: 'Grind and prep only', rate: '' },
      { name: 'Crack and spall repair', rate: '' }
    ],
    colors: ['Dominion', 'Wolf Gray'],
    addons: [
      { name: 'Diamond grinding', price: '' },
      { name: 'Crack repair', price: '' },
      { name: 'Spall / patch repair', price: '' },
      { name: 'Moisture mitigation', price: '' },
      { name: 'Oil stain treatment', price: '' },
      { name: 'Joint fill', price: '' },
      { name: 'Coating removal', price: '' }
    ],
    fields: [
      { id: 'talk', label: 'Talk it through', kind: 'talk', show: true, customer: false },
      { id: 'name', label: 'Customer name', kind: 'text', show: true, customer: true },
      { id: 'address', label: 'Address', kind: 'text', show: true, customer: true },
      { id: 'email', label: 'Customer email', kind: 'text', show: true, customer: true },
      { id: 'phone', label: 'Customer phone', kind: 'text', show: true, customer: false },
      { id: 'jobType', label: 'Job type', kind: 'jobtype', show: true, customer: false },
      { id: 'sqft', label: 'Square footage', kind: 'number', show: true, customer: true },
      { id: 'system', label: 'Coating system', kind: 'system', show: true, customer: true },
      { id: 'color', label: 'Color / flake', kind: 'color', show: true, customer: true },
      { id: 'prep', label: 'Prep', kind: 'prep', show: true, customer: true },
      { id: 'cure', label: 'Cure / return to service', kind: 'cure', show: true, customer: true },
      { id: 'rate', label: 'Price per sq ft', kind: 'number', show: true, customer: true },
      { id: 'hardness', label: 'Concrete hardness (Mohs 1–10)', kind: 'hardness', show: true, customer: false, lock: true },
      { id: 'photos', label: 'Photo attachments', kind: 'photos', show: true, customer: true },
      { id: 'quote', label: 'Notes', kind: 'notes', show: true, customer: false },
      { id: 'addl', label: 'Notes for customer', kind: 'addl', show: true, customer: true },
      { id: 'inote', label: 'Internal notes', kind: 'inote', show: true, customer: false, lock: true }
    ]
  };
}
function normalizeForm(saved) {
  var base = defaultForm();
  saved = saved && typeof saved === 'object' ? saved : {};
  function cleanName(s, n) { return String(s || '').trim().slice(0, n || 80); }
  var systems = Array.isArray(saved.systems) ? saved.systems : base.systems;
  systems = systems.map(function (s) {
    if (typeof s === 'string') s = { name: s, rate: '' };
    var name = cleanName(s && s.name);
    if (!name) return null;
    var rate = s.rate == null || s.rate === '' ? '' : String(s.rate).replace(/[^0-9.]/g, '').slice(0, 10);
    return { name: name, rate: rate };
  }).filter(Boolean).slice(0, 80);
  var colors = Array.isArray(saved.colors) ? saved.colors : base.colors;
  colors = colors.map(function (c) { return cleanName(c, 60); }).filter(Boolean).slice(0, 80);
  var addons = Array.isArray(saved.addons) ? saved.addons : base.addons;
  addons = addons.map(function (a) {
    if (typeof a === 'string') a = { name: a, price: '' };
    var name = cleanName(a && a.name);
    if (!name) return null;
    var price = a.price == null || a.price === '' ? '' : String(a.price).replace(/[^0-9.]/g, '').slice(0, 10);
    return { name: name, price: price };
  }).filter(Boolean).slice(0, 80);
  var defaults = base.fields;
  var known = {};
  defaults.forEach(function (f) { known[f.id] = f; });
  var seen = {};
  var fields = [];
  var src = Array.isArray(saved.fields) ? saved.fields : defaults;
  src.forEach(function (f) {
    if (!f || !f.id || seen[f.id]) return;
    var id = cleanName(f.id, 40);
    var builtin = known[id];
    var kind = builtin ? builtin.kind : cleanName(f.kind, 20);
    if (!builtin && ['text', 'number', 'select', 'check', 'price'].indexOf(kind) < 0) kind = 'text';
    var lock = !!(builtin && builtin.lock) || id === 'hardness' || id === 'inote';
    var opts = Array.isArray(f.options) ? f.options.map(function (x) { return cleanName(x, 60); }).filter(Boolean).slice(0, 40) : [];
    fields.push({
      id: id,
      label: cleanName(f.label || (builtin && builtin.label) || 'Field', 80),
      kind: kind,
      show: f.show === false ? false : true,
      customer: lock ? false : f.customer !== false && (builtin ? !!builtin.customer : !!f.customer),
      lock: lock,
      options: opts,
      price: f.price == null || f.price === '' ? '' : String(f.price).replace(/[^0-9.]/g, '').slice(0, 10)
    });
    seen[id] = 1;
  });
  defaults.forEach(function (f) { if (!seen[f.id]) fields.push(JSON.parse(JSON.stringify(f))); });
  return { systems: systems, colors: colors, addons: addons, fields: fields };
}
function formField(form, id) {
  var list = form && form.fields || [];
  for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
  return null;
}
function customerSees(form, id) {
  if (id === 'hardness' || id === 'inote' || id === 'hardnessHow') return false;
  if (!form) return true;
  var f = formField(form, id);
  if (!f) return true;
  if (f.lock || f.show === false || f.customer === false) return false;
  return true;
}
function customerFace(o){
  o = o || {};
  return Object.assign({}, o, { job: customerJob(o.job) });
}
function specRows(j, form){
  var defs=[
    ['sqft','Square footage',j.sqft?formatSq(j.sqft)+' sq ft':''],
    ['system','Coating system',j.system||''],
    ['color','Color / flake',j.color||''],
    ['prep','Prep',j.prep||''],
    ['cure','Return to service',j.cure||''],
    ['rate','Price per sq ft',j.rate?money(j.rate)+' / sq ft':'']
  ];
  var rows=[];
  defs.forEach(function(d){
    if(!d[2])return;
    if(form&&!customerSees(form,d[0]))return;
    var f=formField(form,d[0]);
    rows.push([(f&&f.label)||d[1], d[2]]);
  });
  var custom=(j&&j.custom)||{};
  ((form&&form.fields)||[]).forEach(function(f){
    if(!f||defs.some(function(d){return d[0]===f.id;}))return;
    if(f.kind==='price'||f.kind==='talk'||f.kind==='photos'||f.kind==='notes'||f.kind==='addl'||f.kind==='hardness'||f.kind==='inote'||f.kind==='jobtype'||f.kind==='prep'||f.kind==='system'||f.kind==='color'||f.kind==='cure')return;
    if(f.show===false||f.customer===false||f.lock)return;
    var v=custom[f.id];
    if(f.kind==='check')v=v?'Yes':'';
    v=String(v==null?'':v).trim();
    if(!v)return;
    rows.push([f.label||'Detail', v.slice(0,400)]);
  });
  if(!rows.length)return '';
  return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:0 0 16px">'+
    rows.map(function(r){
      return '<tr><td style="padding:6px 8px;border-bottom:1px solid #e6e8ee;color:#5c6370;width:42%">'+escHtml(r[0])+'</td><td style="padding:6px 8px;border-bottom:1px solid #e6e8ee"><b>'+escHtml(r[1])+'</b></td></tr>';
    }).join('')+'</table>';
}
function itemsTable(j,colors){
  var dg=colors.dg;
  var list=j.items||[];
  if(!list.length)return '';
  var rows=list.map(function(i,n){
    return '<tr><td style="padding:10px 8px;border-bottom:1px solid #eef0f4;vertical-align:top;color:#8a8f98">'+(n+1)+'</td>'+
      '<td style="padding:10px 8px;border-bottom:1px solid #eef0f4"><b>'+escHtml(i.title)+'</b>'+
      (i.detail?'<br><span style="color:#5c6370;font-size:13px">'+escHtml(i.detail)+'</span>':'')+
      '</td><td style="padding:10px 8px;border-bottom:1px solid #eef0f4;text-align:right;white-space:nowrap">'+
      (i.price==null||i.price===''?'Included':money(Number(i.price)))+'</td></tr>';
  }).join('');
  var tot=j.total!=null?Number(j.total):totalOf(j.items);
  return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px">'+
    '<tr style="background:#f3f4f8"><th style="padding:8px;text-align:left;color:'+dg+'">#</th>'+
    '<th style="padding:8px;text-align:left;color:'+dg+'">Coating work</th>'+
    '<th style="padding:8px;text-align:right;color:'+dg+'">Amount</th></tr>'+rows+
    '<tr><td></td><td style="padding:12px 8px;text-align:right;font-weight:bold">Total</td>'+
    '<td style="padding:12px 8px;text-align:right;font-size:20px;font-weight:bold;color:'+dg+'">'+money(tot)+'</td></tr></table>';
}
function additionalNotesHtml(j, colors){
  var t=String((j&&j.additionalNotes)||'').trim();
  if(!t)return '';
  var n=(colors&&colors.n)||'#3a415c';
  return '<p style="margin:18px 0 6px"><b style="color:'+n+'">Additional notes</b></p><p style="line-height:1.6;margin:0">'+emailText(t)+'</p>';
}
function testBanner(testMode,testTo,customer){
  if(!testMode)return '';
  return '<p style="background:#fff3cd;border:1px solid #e0b100;padding:8px 10px;border-radius:8px;font-size:13px;margin:0 0 14px"><b>TEST MODE</b> &mdash; this email would normally go to the customer: '+
    escHtml(customer||'(no email on the job)')+'. It was sent only to '+escHtml(testTo)+'.</p>';
}
function emailShell(o,inner){
  var n=o.colors.n,dg=o.colors.dg;
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#212020">'+
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:'+n+';border-radius:12px 12px 0 0"><tr>'+
    '<td style="padding:16px 18px;width:200px"><img src="'+o.logoSrc+'" width="180" alt="Southern Concrete Coatings" style="background:#fff;border-radius:8px;padding:4px;display:block"></td>'+
    '<td style="padding:16px 18px 16px 0;color:#fff"><div style="font-size:18px;font-weight:bold">'+escHtml(o.co.name)+'</div>'+
    '<div style="color:#d5d8e4;font-size:14px">'+escHtml(o.title)+(o.sub?' &middot; '+escHtml(o.sub):'')+'</div></td></tr></table>'+
    '<div style="border:1px solid #e1e3ea;border-top:0;padding:22px;border-radius:0 0 12px 12px;background:#fff">'+
    testBanner(o.testMode,o.testTo,o.job&&o.job.email)+inner+
    '<hr style="border:0;border-top:1px solid #e6e8ee;margin:22px 0 12px"><p style="color:#5c6370;font-size:12px;line-height:1.6;margin:0"><b style="color:'+n+'">'+escHtml(o.co.legal)+'</b><br>'+
    escHtml(o.co.addr)+'<br>'+escHtml(o.co.phone)+' &middot; <a href="mailto:'+escHtml(o.testMode?o.testTo:o.co.email)+'" style="color:'+dg+'">'+escHtml(o.testMode?o.testTo:o.co.email)+'</a> &middot; '+
    '<a href="'+escHtml(o.co.site)+'" style="color:'+dg+'">'+escHtml(o.co.web)+'</a><br>Free estimates &middot; Garage floors, flake, metallic epoxy, and commercial coatings &middot; Tallahassee</p></div></div>';
}
function metaBlock(j,label,no,colors){
  var who=[j.name,j.address,j.email].map(function(s){return String(s||'').trim();}).filter(Boolean);
  var left=who.length?'<b style="color:'+colors.n+'">Prepared for</b><br>'+who.map(escHtml).join('<br>'):'';
  var right='<b style="color:'+colors.n+'">'+escHtml(label)+'</b> '+escHtml(no||'');
  if(j.date) right+='<br>Date: '+escHtml(j.date);
  if(!left && !String(no||'').trim() && !j.date) return '';
  return '<table width="100%" style="font-size:14px;margin:0 0 16px"><tr><td style="vertical-align:top">'+left+'</td><td style="vertical-align:top;text-align:right">'+right+'</td></tr></table>';
}
function greetLine(word,name){
  var n=String(name||'').trim();
  if(!n)return '';
  return '<p style="font-size:16px">'+word+' '+escHtml(n)+',</p>';
}
function emailText(s){
  return escHtml(s).replace(/\r\n/g,'\n').replace(/\n/g,'<br>');
}
var QUOTE_EMAIL_BODY='Thank you for considering Southern Concrete Coatings for your project. We appreciate the opportunity to earn your business and look forward to helping bring your vision to life. Below is the estimate for the coating system we discussed. A PDF copy is attached.';
var QUOTE_EMAIL_SUBJECT='Your concrete coating estimate from Southern Concrete Coatings - {estimate}';
var QUOTE_EMAIL_SIGN='Sincerely,\nSouthern Concrete Coatings';
function quoteEmailCopy(o){
  o=o||{};
  var s=o.settings||{};
  var j=o.job||{};
  function pick(key,fallback){
    var v=s[key];
    v=v==null?'':String(v).replace(/\u0000/g,'').trim();
    return v||fallback;
  }
  function fill(text){
    return String(text)
      .replace(/\{name\}/gi,String(j.name||'').trim())
      .replace(/\{estimate\}/gi,String(j.est||'').trim())
      .replace(/\{address\}/gi,String(j.address||'').trim());
  }
  var sign=QUOTE_EMAIL_SIGN;
  if(o.co&&o.co.name) sign='Sincerely,\n'+o.co.name;
  return {
    body:fill(pick('quoteBody',QUOTE_EMAIL_BODY)),
    subject:fill(pick('quoteSubject',QUOTE_EMAIL_SUBJECT)).replace(/[\r\n]+/g,' ').trim(),
    sign:fill(pick('quoteSign',sign))
  };
}
var TERMS=[
  'This estimate is valid for 30 days from the date above.',
  'The price is based on the square footage, coating system, and prep described here. If grinding uncovers extra cracks, spalls, or moisture, we stop and price that work before going on.',
  'Please have vehicles and stored items off the floor before the crew arrives.',
  'Return-to-service time depends on the system and the temperature. The cure time on this estimate is the plan; we will confirm it on site.',
  'One-day installations are available on many garage floors. Heavier metallic and commercial systems can take longer.',
  'Payment is due when the floor is complete, unless the invoice says otherwise.'
];
function payButtons(o){
  var s=o.settings||{}, j=o.job||{}, amt=0;
  if(j.invoice&&j.invoice.amount!=null&&String(j.invoice.amount)!=='') amt=Number(String(j.invoice.amount).replace(/[^0-9.\-]/g,''))||0;
  else if(j.total!=null&&j.total!=='') amt=Number(j.total)||0;
  function linkBtn(href,label,bg){
    if(!href) return '';
    return '<a href="'+escHtml(href)+'" style="display:block;margin:8px 0;padding:15px;background:'+bg+';color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;text-align:center">'+label+'</a>';
  }
  var min=s.finMin==null||s.finMin===''?1000:Number(String(s.finMin).replace(/[^0-9.\-]/g,''));
  if(isNaN(min)) min=1000;
  var html=linkBtn(s.payLink,'Pay now',o.colors.g);
  if(s.finLink&&amt>=min) html+=linkBtn(s.finLink,'Pay over time',o.colors.n);
  return html?'<div style="margin:16px 0">'+html+'</div>':'';
}
function quoteEmailHtml(o){
  o=customerFace(o);
  var j=o.job,g=o.colors.g,dg=o.colors.dg,n=o.colors.n;
  function btn(k,t,c){
    return '<a href="'+o.link(k)+'" style="display:block;margin:8px 0;padding:15px;background:'+c+';color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;text-align:center">'+t+'</a>';
  }
  var copy=quoteEmailCopy(o);
  var inner=greetLine('Dear',j.name)+
    '<p style="line-height:1.6">'+emailText(copy.body)+'</p>'+
    metaBlock(j,'Estimate #',j.est,o.colors)+specRows(j, o.settings&&o.settings.form)+itemsTable(j,o.colors)+additionalNotesHtml(j,o.colors)+
    (o.photosHtml?'<p style="margin:18px 0 6px"><b style="color:'+n+'">Site photos</b></p>'+o.photosHtml:'')+
    '<div style="background:#f4f5f8;border-radius:10px;padding:16px;margin:20px 0"><p style="margin:0 0 4px;font-size:16px"><b style="color:'+n+'">Ready to coat the floor? Tap one:</b></p>'+
    '<p style="margin:0 0 6px;color:#5c6370;font-size:13px">Next we will ask when the crew can have the floor.</p>'+
    btn('A','A) Approve — schedule my floor',g)+
    btn('B','B) Approve with changes',dg)+
    btn('C','C) Decline for now','#8a8f98')+
    btn('O','Other — send a question',n)+'</div>'+
    payButtons(o)+
    '<p style="font-size:13px;color:#5c6370;line-height:1.6"><b>Terms:</b> '+TERMS.join(' ')+'</p>'+
    '<p>'+emailText(copy.sign)+'</p>';
  return emailShell(Object.assign({},o,{title:'Estimate',sub:j.est}),inner);
}
function pdfHtml(o){
  o=customerFace(o);
  var j=o.job;
  var inner=metaBlock(j,'Estimate #',j.est,o.colors)+specRows(j, o.settings&&o.settings.form)+itemsTable(j,o.colors)+additionalNotesHtml(j,o.colors)+
    '<h3 style="color:'+o.colors.n+';margin:22px 0 6px;font-size:15px">Terms</h3><ul style="font-size:13px;color:#33383d;line-height:1.6;padding-left:18px">'+
    TERMS.map(function(t){return '<li>'+escHtml(t)+'</li>';}).join('')+'</ul>'+
    '<p style="font-size:13px">To approve, use the buttons in the estimate email or call '+escHtml(o.co.phone)+'.</p>'+
    '<table width="100%" style="margin-top:28px;font-size:13px"><tr><td>Customer signature: ____________________________</td><td style="text-align:right">Date: ______________</td></tr></table>';
  return '<html><head><style>@page{margin:28px}body{font-family:Arial,Helvetica,sans-serif}</style></head><body>'+
    emailShell(Object.assign({},o,{title:'Estimate',sub:j.est,testMode:false}),inner)+'</body></html>';
}
function recapEmailHtml(o){
  o=customerFace(o);
  var j=o.job,n=o.colors.n,dg=o.colors.dg,g=o.colors.g;
  var av=[j.response&&j.response.avail,j.response&&j.response.when].filter(Boolean).join(' - ');
  var referHref='mailto:?subject='+encodeURIComponent('Floor coating I recommend: Southern Concrete Coatings')+
    '&body='+encodeURIComponent('I used Southern Concrete Coatings in Tallahassee and was happy with the floor. Free estimates: '+o.co.site+' or '+o.co.phone);
  var refer='<a href="'+referHref+'" style="display:block;padding:15px;background:'+g+';color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;text-align:center;font-size:16px">Refer a neighbor</a>';
  var where=String(j.address||'').trim();
  var inner=greetLine('Hi',j.name)+
    '<p style="line-height:1.6">'+(where?'Your coating at '+escHtml(where)+' is complete.':'Your coating is complete.')+' Here is a look at the floor, before and after.</p>'+
    specRows(j, o.settings&&o.settings.form)+itemsTable(j,o.colors)+
    (av?'<p><b style="color:'+n+'">Scheduled from your preference:</b> '+escHtml(av)+'</p>':'')+
    (j.crewNotes?'<p><b style="color:'+n+'">Crew notes:</b> '+escHtml(j.crewNotes)+'</p>':'')+
    '<h3 style="color:'+dg+'">Before</h3>'+(o.beforeHtml||'<p style="color:#8a8f98">No photos</p>')+
    '<h3 style="color:'+dg+'">After</h3>'+(o.afterHtml||'<p style="color:#8a8f98">No photos</p>')+
    '<p style="line-height:1.6">Thank you for choosing Southern Concrete Coatings. If the floor turned out the way you wanted, we would be grateful if you passed our name to a neighbor.</p>'+refer;
  return emailShell(Object.assign({},o,{title:'Your floor is done',sub:j.est||''}),inner);
}
function invoiceEmailHtml(o){
  o=customerFace(o);
  var j=o.job,v=j.invoice||{},inv=String(j.est||j.id).replace('EST','INV');
  var inner=greetLine('Dear',j.name)+
    '<p>Thank you for your business. Here is the invoice for the completed coating.</p>'+
    metaBlock(j,'Invoice #',inv,o.colors)+specRows(j, o.settings&&o.settings.form)+itemsTable(j,o.colors)+
    '<p style="font-size:18px;text-align:right"><b>Amount due: <span style="color:'+o.colors.dg+'">'+escHtml(v.amount)+'</span></b></p>'+
    additionalNotesHtml(j,o.colors)+
    (v.note?'<p>'+escHtml(v.note)+'</p>':'')+
    payButtons(o)+
    '<p>Questions? Call '+escHtml(o.co.phone)+'.</p>';
  return emailShell(Object.assign({},o,{title:'Invoice',sub:inv}),inner);
}
function responseFormHtml(o){
  o=customerFace(o);
  var j=o.job,ans=o.ans,labels=o.labels,slots=o.slots,action=o.action;
  var slotHtml=slots.map(function(s,i){
    return '<label style="display:block;width:100%;margin:8px 0;padding:18px;font-size:19px;font-weight:bold;border:3px solid '+o.colors.n+';background:#fff;color:'+o.colors.n+';border-radius:12px;text-align:center;box-sizing:border-box"><input type="radio" name="avail" value="'+escHtml(s)+'"'+(i===slots.length-1?' checked':'')+' style="margin-right:8px">'+escHtml(s)+'</label>';
  }).join('');
  var ask=(ans==='B'||ans==='O')?'<p><b>'+(ans==='B'?'What would you like changed?':'Your question or message:')+'</b></p><textarea name="text" rows="4" style="width:100%;box-sizing:border-box;font-size:17px;padding:14px;border:2px solid #cfd3de;border-radius:10px"></textarea>':'';
  var where=String(j.address||'').trim();
  var notes=additionalNotesHtml(j,o.colors);
  return '<h2 style="color:'+o.colors.n+'">'+escHtml(labels[ans]||ans)+'</h2><p>Estimate '+escHtml(j.est||j.id)+(where?' &middot; '+escHtml(where):'')+'</p>'+
    (notes?itemsTable(j,o.colors)+notes:'')+
    '<form method="get" action="'+escHtml(action)+'">'+
    '<input type="hidden" name="a" value="respond"><input type="hidden" name="id" value="'+escHtml(j.id)+'">'+
    '<input type="hidden" name="ans" value="'+escHtml(ans)+'"><input type="hidden" name="done" value="1">'+ask+
    '<p><b>When can the crew have the floor?</b> Tap one. The floor needs to be clear at the start of that window.</p>'+slotHtml+
    '<p><b>Preferred date or time (optional)</b></p><input type="text" name="when" placeholder="e.g. Tuesday morning" style="width:100%;box-sizing:border-box;font-size:17px;padding:14px;border:2px solid #cfd3de;border-radius:10px">'+
    '<button style="width:100%;padding:20px;font-size:21px;font-weight:bold;background:'+o.colors.g+';color:#fff;border:0;border-radius:12px;margin-top:14px">Send my answer</button></form>';
}
function responseThanksHtml(o){
  o=customerFace(o);
  var j=o.job||{}, r=j.response||{};
  var av=[r.avail,r.when].filter(Boolean).join(' - ');
  return '<h2 style="color:'+o.colors.dg+'">Thank you</h2><p style="font-size:17px">Your answer was received: <b>'+escHtml(r.label||'')+'</b></p>'+
    (av?'<p>Preferred time: <b>'+escHtml(av)+'</b></p>':'')+
    (r.text?'<p>Your note: '+escHtml(r.text)+'</p>':'')+
    '<p>We will confirm the installation window. Questions? Call '+escHtml(o.co.phone)+'.</p>';
}
function reviewEmailHtml(o){
  o=customerFace(o);
  var j=o.job||{}, link=(o.settings&&o.settings.reviewLink)||'';
  var btn=link?'<a href="'+escHtml(link)+'" style="display:block;margin:16px 0;padding:15px;background:'+o.colors.g+';color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;text-align:center">Leave a review</a>':'';
  var inner=greetLine('Hi',j.name)+
    '<p style="line-height:1.6">Thank you for choosing Southern Concrete Coatings. If you were happy with the floor, a short Google review helps neighbors find us.</p>'+
    btn+'<p>Questions? Call '+escHtml(o.co.phone)+'.</p>';
  return emailShell(Object.assign({},o,{title:'How did we do?',sub:j.est||''}),inner);
}

var SCCQuote={
  round2:round2,money:money,validEmail:validEmail,formatSq:formatSq,
  deliveryAddress:deliveryAddress,rewriteQuote:rewriteQuote,buildItems:buildItems,totalOf:totalOf,
  parseSqft:parseSqft,parseRate:parseRate,parseLump:parseLump,
  quoteEmailHtml:quoteEmailHtml,pdfHtml:pdfHtml,recapEmailHtml:recapEmailHtml,invoiceEmailHtml:invoiceEmailHtml,
  responseFormHtml:responseFormHtml,responseThanksHtml:responseThanksHtml,reviewEmailHtml:reviewEmailHtml,
  customerJob:customerJob,defaultForm:defaultForm,normalizeForm:normalizeForm,TERMS:TERMS,escHtml:escHtml,
  QUOTE_EMAIL_BODY:QUOTE_EMAIL_BODY,QUOTE_EMAIL_SUBJECT:QUOTE_EMAIL_SUBJECT,QUOTE_EMAIL_SIGN:QUOTE_EMAIL_SIGN,
  quoteEmailCopy:quoteEmailCopy
};
if(typeof module!=='undefined'&&module.exports)module.exports=SCCQuote;
var TEST_MODE = false; // single server flag — keep identical to config.js TEST_MODE
var TEST_TO = 'austin@techsourcedsolutions.com';
var ROOT_NAME = 'Southern Concrete Coatings';
var CO = {
  name: 'Southern Concrete Coatings',
  legal: 'Southern Concrete Coatings LLC',
  addr: 'Tallahassee, FL',
  phone: '(850) 766-9992',
  email: 'mccardlematt@yahoo.com',
  web: 'www.southernconcretecoatingsllc.com',
  site: 'https://www.southernconcretecoatingsllc.com/'
};
var COLORS = { n: '#3a415c', g: '#424866', dg: '#2a3148' };
var LOGO = 'data:image/png;base64,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';
var LABELS = { A: 'Approved', B: 'Approved with changes', C: 'Declined', O: 'Question / other' };
var SLOTS = ['Weekdays 8-12', 'Weekdays 12-5', 'Weekends', 'Anytime'];

function root_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('ROOT');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(ROOT_NAME);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_NAME);
  p.setProperty('ROOT', f.getId());
  return f;
}
function file_(n) {
  var r = root_(), it = r.getFilesByName(n);
  return it.hasNext() ? it.next() : r.createFile(n, '[]', 'application/json');
}
function load_(n) { return JSON.parse(file_(n || 'jobs.json').getBlob().getDataAsString() || '[]'); }
function save_(j, n) { file_(n || 'jobs.json').setContent(JSON.stringify(j)); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(s) { return String(s || '').replace(/[\\\/]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); }
function folder_(j) {
  var r = root_();
  if (j.folderId) { try { return DriveApp.getFolderById(j.folderId); } catch (e) {} }
  var n = clean_(j.id) + ' - ' + clean_(j.name) + ' - ' + clean_(j.address);
  var it = r.getFoldersByName(n);
  var f = it.hasNext() ? it.next() : r.createFolder(n);
  j.folder = f.getUrl();
  j.folderId = f.getId();
  return f;
}
function savePhotos_(j, list, kind) {
  var f = folder_(j);
  return (list || []).map(function (d, i) {
    var b = Utilities.newBlob(Utilities.base64Decode(String(d).split(',')[1]), 'image/jpeg', kind + '-' + Date.now() + '-' + i + '.jpg');
    var x = f.createFile(b);
    x.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { id: x.getId(), url: 'https://drive.google.com/thumbnail?id=' + x.getId() + '&sz=w1200', kind: kind };
  });
}
function estNo_() {
  var p = PropertiesService.getScriptProperties(), y = new Date().getFullYear(), k = 'EST' + y;
  var n = Number(p.getProperty(k) || 0) + 1;
  p.setProperty(k, String(n));
  return 'SCC-EST-' + y + '-' + ('000' + n).slice(-4);
}
function today_() { return Utilities.formatDate(new Date(), 'America/New_York', 'MMMM d, yyyy'); }
function view_(j) {
  var o = JSON.parse(JSON.stringify(j));
  o.date = today_();
  delete o.hardness;
  delete o.hardnessHow;
  delete o.internalNotes;
  delete o.aiNote;
  delete o.phone2;
  delete o.contact2;
  delete o.callAnswers;
  delete o.smsReminded;
  return o;
}
function logoBlob_() {
  return Utilities.newBlob(Utilities.base64Decode(LOGO.split(',')[1]), 'image/png', 'logo.png');
}
function imgs_(ps, pre) {
  var inl = {}, h = '';
  (ps || []).forEach(function (p, i) {
    if (!p.id) return;
    inl[pre + i] = DriveApp.getFileById(p.id).getBlob();
    h += '<img src="cid:' + pre + i + '" alt="" style="width:48%;max-width:290px;border-radius:8px;margin:4px 1%;display:inline-block">';
  });
  return { inl: inl, h: h };
}
function respUrl_(j, k) {
  return ScriptApp.getService().getUrl() + '?a=respond&id=' + encodeURIComponent(j.id) + '&ans=' + k;
}
function envelope_(j) {
  var env = deliveryAddress(TEST_MODE, TEST_TO, j && j.email, CO.email);
  if (TEST_MODE && (env.to !== TEST_TO || env.replyTo !== TEST_TO)) {
    throw new Error('Test mode blocked a send that was not addressed only to ' + TEST_TO);
  }
  return env;
}
function sendMail_(msg) {
  var env = envelope_(msg.job);
  if (!env.to) return;
  var payload = {
    to: env.to,
    replyTo: env.replyTo,
    name: msg.name || CO.name,
    subject: (TEST_MODE ? 'TEST - ' : '') + msg.subject,
    htmlBody: msg.html
  };
  if (msg.body) payload.body = msg.body;
  if (msg.inlineImages) payload.inlineImages = msg.inlineImages;
  if (msg.attachments) payload.attachments = msg.attachments;
  if (msg.quote && !TEST_MODE) {
    var bcc = quoteBcc_(settings_().quoteBcc);
    if (bcc && bcc.toLowerCase() !== String(env.to || '').toLowerCase()) payload.bcc = bcc;
  }
  MailApp.sendEmail(payload);
}
function mailOpts_(j) {
  return { co: CO, colors: COLORS, job: view_(j), testMode: TEST_MODE, testTo: TEST_TO, logoSrc: 'cid:logo', settings: settings_() };
}
function makePdf_(j) {
  var html = pdfHtml(Object.assign(mailOpts_(j), { logoSrc: LOGO }));
  var b = Utilities.newBlob(html, 'text/html', 'estimate.html').getAs('application/pdf').setName('Southern Concrete Coatings Estimate ' + j.est + '.pdf');
  var f = folder_(j).createFile(b);
  j.pdf = f.getUrl();
  j.pdfId = f.getId();
  return b;
}
function customerOk_(j) {
  if (j.email && !validEmail(j.email)) throw new Error('That customer email does not look valid.');
}
function sendQuote_(j) {
  customerOk_(j);
  var im = imgs_(j.photos, 'q');
  im.inl.logo = logoBlob_();
  var pdf = null;
  if (j.pdfId) { try { pdf = DriveApp.getFileById(j.pdfId).getBlob().setName('Southern Concrete Coatings Estimate ' + j.est + '.pdf'); } catch (e) { pdf = null; } }
  if (!pdf) pdf = makePdf_(j);
  var copy = quoteEmailCopy(mailOpts_(j));
  j.emailed = !!envelope_(j).to;
  if (!j.emailed) return;
  sendMail_({
    job: j,
    quote: true,
    subject: copy.subject,
    html: quoteEmailHtml(Object.assign(mailOpts_(j), { photosHtml: im.h, link: function (k) { return respUrl_(j, k); } })),
    inlineImages: im.inl,
    attachments: [pdf]
  });
}
function sendRecap_(j) {
  customerOk_(j);
  var ib = imgs_((j.crew || []).filter(function (p) { return p.kind === 'before'; }), 'b');
  var ia = imgs_((j.crew || []).filter(function (p) { return p.kind === 'after'; }), 'a');
  var inl = { logo: logoBlob_() }, k;
  for (k in ib.inl) inl[k] = ib.inl[k];
  for (k in ia.inl) inl[k] = ia.inl[k];
  sendMail_({
    job: j,
    subject: 'Your floor is done - Southern Concrete Coatings',
    html: recapEmailHtml(Object.assign(mailOpts_(j), { beforeHtml: ib.h, afterHtml: ia.h })),
    inlineImages: inl
  });
}
function sendInvoice_(j) {
  customerOk_(j);
  sendMail_({
    job: j,
    subject: 'Invoice from Southern Concrete Coatings - ' + (j.invoice && j.invoice.amount || ''),
    html: invoiceEmailHtml(mailOpts_(j)),
    inlineImages: { logo: logoBlob_() }
  });
}
function respond_(j, p) {
  j.response = {
    ans: p.ans,
    label: LABELS[p.ans] || p.ans,
    text: p.text || '',
    avail: p.avail || '',
    when: p.when || '',
    at: new Date().toISOString()
  };
  j.status = (p.ans === 'A' || p.ans === 'B') ? 'approved' : (p.ans === 'C' ? 'declined' : 'reply');
}
function page_(body) {
  var css = 'body{margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#212020}.w{max-width:520px;margin:0 auto;padding:18px}';
  return HtmlService.createHtmlOutput(
    '<meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style>' +
    '<div style="background:' + COLORS.n + ';color:#fff;padding:14px 18px;font-weight:bold;font-size:18px">Southern Concrete Coatings</div>' +
    (TEST_MODE ? '<div style="background:#fff3cd;color:#5c4300;padding:10px 14px;font-weight:bold">Test mode — messages about this estimate go only to ' + TEST_TO + '</div>' : '') +
    '<div class="w">' + body + '</div>'
  ).setTitle('Southern Concrete Coatings').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

var OWNER_PIN = '1234';
function pinOk_(d) { return String(d && d.pin || '') === OWNER_PIN; }
function loadObj_(n) {
  var raw = '';
  try { raw = file_(n).getBlob().getDataAsString() || ''; } catch (e) { raw = ''; }
  if (!raw || raw === '[]') return {};
  try {
    var o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    return o;
  } catch (e2) { return {}; }
}
function quoteBcc_(raw) {
  var s = String(raw == null ? '' : raw).trim().slice(0, 120);
  if (/^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(s)) return s;
  return 'mccardlematt@yahoo.com';
}
function settings_() {
  var o = loadObj_('settings.json');
  var min = o.finMin == null || o.finMin === '' ? 1000 : Number(String(o.finMin).replace(/[^0-9.\-]/g, ''));
  if (isNaN(min)) min = 1000;
  return {
    payLink: String(o.payLink || ''), reviewLink: String(o.reviewLink || ''), finLink: String(o.finLink || ''), finMin: min, ocr: o.ocr === false ? false : true, qbo: qboPublic_(),
    form: normalizeForm(o.form), mileRate: mileRate_(o.mileRate), theme: o.theme === 'classic' ? 'classic' : 'dark',
    quoteBody: String(o.quoteBody || ''), quoteSubject: String(o.quoteSubject || ''), quoteSign: String(o.quoteSign || ''),
    quoteBcc: quoteBcc_(o.quoteBcc),
    galleryHide: galleryHide_(o.galleryHide),
    reminders: reminderCfg_(o),
    texts: smsCfg_(o)
  };
}
function moneyNum_(v) {
  var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function hardnessVal_(v) {
  if (v == null || String(v).trim() === '') return '';
  var n = Number(v);
  if (n !== Math.floor(n) || n < 1 || n > 10) return null;
  return n;
}
function expenses_() {
  var list = load_('expenses.json');
  return Array.isArray(list) ? list : [];
}
function receiptsFolder_() {
  var r = root_();
  var it = r.getFoldersByName('Receipts');
  return it.hasNext() ? it.next() : r.createFolder('Receipts');
}
function galleryFolder_() {
  var r = root_();
  var it = r.getFoldersByName('Gallery');
  return it.hasNext() ? it.next() : r.createFolder('Gallery');
}
function gallery_() {
  var list = load_('gallery.json');
  return Array.isArray(list) ? list : [];
}
function galleryHide_(v) {
  var a = Array.isArray(v) ? v : [];
  var out = [], seen = {};
  for (var i = 0; i < a.length && out.length < 200; i++) {
    var id = String(a[i] || '').trim().slice(0, 80);
    if (!id || seen[id] || id.indexOf('sim-') !== 0) continue;
    seen[id] = 1;
    out.push(id);
  }
  return out;
}
function e164_(raw) {
  var d = String(raw == null ? '' : raw).replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d.charAt(0) === '1') return '+' + d;
  return '';
}
function questionsFrom_(list) {
  var fallback = [{ text: 'Will the driveway or work area be cleared before we arrive?', type: 'yesno' }];
  if (!Array.isArray(list)) return fallback;
  var out = [], i, text, type;
  for (i = 0; i < list.length && out.length < 8; i++) {
    text = String((list[i] && list[i].text) || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!text) continue;
    type = list[i] && list[i].type === 'speech' ? 'speech' : 'yesno';
    out.push({ text: text, type: type });
  }
  return out;
}
function reminderCfg_(o) {
  var r = o && o.reminders;
  return {
    on: !!(r && r.on === true),
    test: !r || r.test !== false,
    testPhone: String((r && r.testPhone) || '').slice(0, 40),
    questions: (r && Array.isArray(r.questions)) ? questionsFrom_(r.questions) : questionsFrom_(null)
  };
}
function reminderDial_(s, customerPhone) {
  var on = !!(s && s.on);
  var test = !s || s.test !== false;
  var testPhone = e164_(s && s.testPhone);
  var cust = e164_(customerPhone);
  if (!on) return { skip: 'off' };
  if (test) {
    if (!testPhone) return { skip: 'no test number' };
    return { dial: testPhone, test: true };
  }
  if (!cust) return { skip: 'no phone' };
  return { dial: cust, test: false };
}
function guardDial_(choice, testPhone, customerPhone) {
  if (!choice || choice.skip || !choice.dial) return false;
  if (choice.test) return choice.dial === e164_(testPhone);
  return choice.dial === e164_(customerPhone);
}
function smsDefault24_() {
  return "Hi {name}, this is Southern Concrete Coatings. Reminder: we're scheduled for estimate {est} ({work}) at {address} on {date} at {time}. See you then!";
}
function smsDefaultDay_() {
  return "Hey {name}, Southern Concrete Coatings here. We're on the way today at {time} for estimate {est} ({work}).";
}
function smsOld24_() {
  return "Hi {name}, this is Southern Concrete Coatings. Reminder: we're scheduled at {address} on {date} at {time}. See you then!";
}
function smsOldDay_() {
  return "Hey {name}, Southern Concrete Coatings here, we're on the way for your {time} appointment today.";
}
function smsStored_(raw, fallback, old) {
  var s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s || s === old) return fallback;
  return s.slice(0, 480);
}
function smsCfg_(o) {
  var t = o && o.texts;
  var calls = o && o.reminders;
  var phone = String((t && t.testPhone) || '').trim();
  if (!phone) phone = String((calls && calls.testPhone) || '').trim();
  if (!phone) phone = '8504453792';
  var t24 = String((t && t.t24) || '').replace(/\s+/g, ' ').trim();
  var day = String((t && t.dayof) || '').replace(/\s+/g, ' ').trim();
  return {
    on: !!(t && t.on === true),
    test: !t || t.test !== false,
    testPhone: phone.slice(0, 40),
    t24: smsStored_(t24, smsDefault24_(), smsOld24_()),
    dayof: smsStored_(day, smsDefaultDay_(), smsOldDay_())
  };
}
function smsDial_(s, customerPhone) {
  var on = !!(s && s.on);
  var test = !s || s.test !== false;
  var testPhone = e164_(s && s.testPhone);
  var cust = e164_(customerPhone);
  if (!on) return { skip: 'off' };
  if (test) {
    if (!testPhone) return { skip: 'no test number' };
    return { dial: testPhone, test: true };
  }
  if (!cust) return { skip: 'no phone' };
  return { dial: cust, test: false };
}
function smsBit_(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 80);
}
function smsEst_(raw) {
  var est = smsBit_(raw, 40);
  var m = est.match(/^SCC-EST-\d{4}-(\d+)$/i);
  if (m) return 'EST-' + m[1];
  return est;
}
function smsSq_(sqft) {
  if (sqft == null || String(sqft).trim() === '') return '';
  var n = Number(String(sqft).replace(/,/g, ''));
  if (!isFinite(n) || n <= 0) return '';
  var r = Math.round(n * 10) / 10;
  var s = String(r);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  var parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.') + ' sq ft';
}
function smsWork_(system, sqft) {
  var name = smsBit_(system, 80);
  var area = smsSq_(sqft);
  if (name && area) return (name + ', ' + area).slice(0, 140);
  return (name || area).slice(0, 140);
}
function smsTidy_(text) {
  var s = String(text || '');
  s = s.replace(/\(\s*\)/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\bestimate\s+\(/gi, '(');
  s = s.replace(/\bestimate\s+(at|on|for)\b/gi, '$1');
  s = s.replace(/\bestimate\s*([.!?])/gi, '$1');
  s = s.replace(/\s+for\s*([.!?])/gi, '$1');
  s = s.replace(/\s+for\s+(at|on)\b/gi, ' $1');
  s = s.replace(/\bat\s+on\b/gi, 'on');
  s = s.replace(/\bon\s+at\b/gi, 'at');
  s = s.replace(/\bat\s+at\b/gi, 'at');
  s = s.replace(/\bat\s*([.!?])/gi, '$1');
  s = s.replace(/\s+,/g, ',');
  s = s.replace(/,\s*,/g, ',');
  s = s.replace(/\(\s+/g, '(');
  s = s.replace(/\s+\)/g, ')');
  s = s.replace(/\s+([.!?])/g, '$1');
  s = s.replace(/\s{2,}/g, ' ');
  return s.trim();
}
function smsFill_(template, fields) {
  var f = fields || {};
  var map = {
    name: smsBit_(f.name, 80),
    address: smsBit_(f.address, 120),
    date: smsBit_(f.date, 60),
    time: smsBit_(f.time, 20),
    est: smsBit_(f.est, 40),
    work: smsBit_(f.work, 140)
  };
  var text = String(template || '');
  text = text.replace(/\{(name|address|date|time|est|work)\}/gi, function (_, key) { return map[String(key).toLowerCase()] || ''; });
  text = text.replace(/\{hardnessHow\}/gi, '').replace(/\{hardness\}/gi, '').replace(/\{internalNotes\}/gi, '').replace(/\{notes\}/gi, '');
  return smsTidy_(text).slice(0, 480);
}
function smsSendAtMs_(startMs, sevenMs) {
  var two = Number(startMs) - 2 * 36e5;
  if (sevenMs == null || isNaN(Number(sevenMs))) return two;
  return Math.min(two, Number(sevenMs));
}
function smsDayDue_(startMs, sevenMs, nowMs) {
  var sendAt = smsSendAtMs_(startMs, sevenMs);
  var now = Number(nowMs);
  if (now < sendAt || now >= Number(startMs)) return false;
  return now - sendAt <= 2 * 36e5;
}
function reminderDue_(startMs, nowMs) {
  var h = (Number(startMs) - Number(nowMs)) / 36e5;
  return h >= 20 && h <= 28;
}
function reminderSay_(jobName, dateLabel, timeLabel, address) {
  var line = 'Hi, this is Southern Concrete Coatings reminding you of your appointment for ' + (jobName || 'your floor') + ' on ' + dateLabel + ' at ' + timeLabel;
  address = String(address || '').replace(/\s+/g, ' ').trim();
  if (address) line += ' at ' + address;
  line += '. Call us if you need to reschedule.';
  return line;
}
function manualSay_() {
  return 'This is Southern Concrete Coatings calling with a reminder about your upcoming service. Call us with any questions.';
}
function xmlEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function reminderTwiml_(text) {
  return '<Response><Say voice="Polly.Matthew-Neural">' + xmlEsc_(text) + '</Say></Response>';
}
function goodbyeTwiml_() {
  return '<Say voice="Polly.Matthew-Neural">' + xmlEsc_('Thanks, see you then. Call us if anything changes.') + '</Say>';
}
function questionPrompt_(q) {
  var line = String(q && q.text || '').replace(/\s+/g, ' ').trim();
  if (!q || q.type !== 'speech') line += ' Press 1 for yes, 2 for no.';
  line += ' Press 0 to request a callback.';
  return line.replace(/\s+/g, ' ').trim();
}
function voiceMsg_(jobId, logId, qIndex) {
  return String(jobId || '') + '|' + String(logId || '') + '|' + String(qIndex);
}
function voiceToken_(jobId, logId, qIndex, secret, sign) {
  return sign(voiceMsg_(jobId, logId, qIndex), String(secret || ''));
}
function voiceOk_(jobId, logId, qIndex, token, secret, sign) {
  if (!secret || !token || !sign) return false;
  return voiceToken_(jobId, logId, qIndex, secret, sign) === String(token);
}
function voiceUrl_(base, jobId, logId, qIndex, token) {
  var b = String(base || '').replace(/\?.*$/, '').replace(/\/$/, '');
  return b + '?a=twvoice&job=' + encodeURIComponent(jobId || '') + '&log=' + encodeURIComponent(logId || '') + '&q=' + encodeURIComponent(String(qIndex)) + '&tok=' + encodeURIComponent(token || '');
}
function gatherXml_(q, action) {
  return '<Gather input="dtmf speech" numDigits="1" timeout="6" speechTimeout="auto" method="GET" action="' + xmlEsc_(action) + '"><Say voice="Polly.Matthew-Neural">' + xmlEsc_(questionPrompt_(q)) + '</Say></Gather>';
}
function openingTwiml_(intro, questions, action) {
  var qs = Array.isArray(questions) ? questions : [];
  var xml = '<Response>';
  if (intro) xml += '<Say voice="Polly.Matthew-Neural">' + xmlEsc_(intro) + '</Say>';
  if (qs.length && action) xml += gatherXml_(qs[0], action);
  xml += goodbyeTwiml_();
  xml += '</Response>';
  return xml;
}
function callTwiml_(intro, questions, jobId, logId, secret, base, sign) {
  var qs = Array.isArray(questions) ? questions : [];
  var action = '';
  if (qs.length && base && secret && sign) action = voiceUrl_(base, jobId, logId, 0, voiceToken_(jobId, logId, 0, secret, sign));
  return openingTwiml_(intro, qs, action);
}
function voiceAnswer_(type, digits, speech) {
  var d = String(digits == null ? '' : digits).replace(/\D/g, '');
  var key = d ? d.charAt(0) : '';
  var said = String(speech == null ? '' : speech).replace(/\s+/g, ' ').trim().slice(0, 500);
  var low = said.toLowerCase();
  if (key === '0') return { answer: '', callback: true };
  if (low && /\b(callback|call me back)\b/.test(low) && (type === 'speech' ? said.length < 40 : true)) return { answer: '', callback: true };
  if (type === 'speech') return said ? { answer: said, callback: false } : null;
  if (key === '1') return { answer: 'yes', callback: false };
  if (key === '2') return { answer: 'no', callback: false };
  if (low && /\b(no|nope)\b/.test(low)) return { answer: 'no', callback: false };
  if (low && /\b(yes|yeah|yep)\b/.test(low)) return { answer: 'yes', callback: false };
  return null;
}
function voiceRejectTwiml_() {
  return '<Response><Say voice="Polly.Matthew-Neural">Sorry, this reminder cannot continue.</Say><Hangup/></Response>';
}
function voiceStep_(opts) {
  var o = opts || {};
  var jobId = String(o.jobId || '');
  var logId = String(o.logId || '');
  var qIndex = parseInt(o.q, 10);
  var sign = o.sign;
  if (!sign || isNaN(qIndex) || qIndex < 0 || qIndex > 20 || !voiceOk_(jobId, logId, qIndex, o.tok, o.secret, sign)) {
    return { ok: false, twiml: voiceRejectTwiml_(), save: null };
  }
  var qs = Array.isArray(o.questions) ? o.questions : [];
  var question = qs[qIndex];
  if (!question) return { ok: true, twiml: '<Response>' + goodbyeTwiml_() + '</Response>', save: null };
  var parsed = voiceAnswer_(question.type, o.digits, o.speech);
  var save = null;
  if (parsed && (parsed.answer || parsed.callback)) {
    save = {
      q: question.text,
      type: question.type === 'speech' ? 'speech' : 'yesno',
      answer: parsed.answer || '',
      callback: !!parsed.callback
    };
  }
  var next = qIndex + 1;
  if (next >= qs.length || !o.base) return { ok: true, twiml: '<Response>' + goodbyeTwiml_() + '</Response>', save: save };
  var action = voiceUrl_(o.base, jobId, logId, next, voiceToken_(jobId, logId, next, o.secret, sign));
  return { ok: true, twiml: '<Response>' + gatherXml_(qs[next], action) + goodbyeTwiml_() + '</Response>', save: save };
}
function reminderFinal_(status) {
  var s = String(status || '');
  return s === 'completed' || s === 'busy' || s === 'failed' || s === 'no-answer' || s === 'canceled';
}
function scriptProp_(name) {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(name);
    return v ? String(v) : '';
  } catch (eProp) { return ''; }
}
function geminiModel_() {
  return scriptProp_('GEMINI_MODEL') || 'gemini-3.8-flash';
}
function geminiConfig_(model) {
  var gen = { responseMimeType: 'application/json' };
  if (/gemini-[34]/.test(String(model || '')) || model === 'gemini-flash-latest') gen.thinkingConfig = { thinkingLevel: 'low' };
  return gen;
}
function clipErr_(body, key) {
  var s = String(body || '').replace(/\s+/g, ' ').trim();
  if (key) s = s.split(key).join('[redacted]');
  return s.slice(0, 200);
}
function geminiFetch_(key, model, parts) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { 'x-goog-api-key': key },
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: parts }],
      generationConfig: geminiConfig_(model)
    })
  });
  return { code: res.getResponseCode(), body: res.getContentText() || '' };
}
function geminiWalk_(model, fetchModel, sleep) {
  var waits = [0, 1000, 3000];
  var last = { code: 0, body: '' };
  var i;
  for (i = 0; i < waits.length; i++) {
    if (waits[i] && sleep) sleep(waits[i]);
    try { last = fetchModel(model) || { code: 0, body: '' }; }
    catch (eTry) { last = { code: 0, body: '' }; }
    if (last.code >= 200 && last.code < 300) return last;
    if (!(last.code === 429 || last.code === 500 || last.code === 503 || last.code === 0)) break;
  }
  if (model === 'gemini-flash-latest') return last;
  try { last = fetchModel('gemini-flash-latest') || last; }
  catch (eAlt) {}
  return last;
}
function geminiGenerate_(key, parts) {
  return geminiWalk_(geminiModel_(), function (model) { return geminiFetch_(key, model, parts); }, function (ms) { Utilities.sleep(ms); });
}
function normalizeMeasure_(raw) {
  var o = raw;
  if (typeof raw === 'string') {
    var t = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    var start = t.indexOf('{'), end = t.lastIndexOf('}');
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
    try { o = JSON.parse(t); } catch (eJson) { return null; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  function num(v) {
    var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    if (isNaN(n) || n <= 0 || n > 100000) return null;
    return Math.round(n * 10) / 10;
  }
  var lengthFt = num(o.lengthFt != null ? o.lengthFt : o.length);
  var widthFt = num(o.widthFt != null ? o.widthFt : o.width);
  var sqft = num(o.sqft != null ? o.sqft : (o.squareFeet != null ? o.squareFeet : o.area));
  if (!sqft && lengthFt && widthFt) sqft = Math.round(lengthFt * widthFt * 10) / 10;
  if (!sqft) return null;
  var conf = String(o.confidence || 'low').toLowerCase();
  if (conf !== 'low' && conf !== 'medium' && conf !== 'high') conf = 'low';
  var note = String(o.note || o.reasoning || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  return { lengthFt: lengthFt, widthFt: widthFt, sqft: Math.round(sqft), confidence: conf, note: note };
}
function geminiText_(parsed) {
  var c = parsed && parsed.candidates && parsed.candidates[0];
  var parts = (c && c.content && c.content.parts) || [];
  var text = '';
  for (var i = 0; i < parts.length; i++) if (parts[i] && parts[i].text && !parts[i].thought) text += parts[i].text;
  return text;
}
function measureFail_() {
  return { ok: true, ready: false, message: 'Could not measure that photo. Enter the square footage by hand.' };
}
function measureFloor_(images, known) {
  // GEMINI_API_KEY and optional GEMINI_MODEL are Script Properties. Never paste the key into this file.
  var key = scriptProp_('GEMINI_API_KEY');
  if (!key) return { ok: true, ready: false, message: 'AI measuring not set up yet' };
  var shots = Array.isArray(images) ? images : (images ? [images] : []);
  var parts = [];
  var prompt = 'You measure concrete floors from photos for a coatings contractor. Estimate the floor length, width, and area in feet and square feet. Use reference cues when they are visible: a single-car garage door is about 8 or 9 feet wide, a double-car garage door is about 16 feet wide, a typical car is about 6 feet wide and 14 to 16 feet long, and count the bays. If the contractor gives one known dimension, trust it and scale the other dimension from the photo. Return JSON with keys lengthFt, widthFt, sqft, confidence (low, medium, or high), and note. The note is one or two sentences on the cues you used. Do not include a price.';
  var knownText = String(known || '').trim().slice(0, 200);
  if (knownText) prompt += ' Known dimension from the contractor: ' + knownText;
  for (var i = 0; i < shots.length && parts.length < 4; i++) {
    var s = String(shots[i] || '');
    var m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!m || m[2].length > 2000000) continue;
    parts.push({ inline_data: { mime_type: m[1], data: m[2].replace(/\s/g, '') } });
  }
  if (!parts.length) return { ok: true, ready: false, message: 'Add a photo of the floor first' };
  parts.unshift({ text: prompt });
  var gotFetch = geminiGenerate_(key, parts);
  if (!gotFetch || gotFetch.code < 200 || gotFetch.code >= 300) return measureFail_();
  var parsed;
  try { parsed = JSON.parse(gotFetch.body); } catch (eParse) { return measureFail_(); }
  var got = normalizeMeasure_(geminiText_(parsed));
  if (!got) return measureFail_();
  return { ok: true, ready: true, sqft: got.sqft, lengthFt: got.lengthFt, widthFt: got.widthFt, confidence: got.confidence, note: got.note };
}
function normalizeFill_(raw) {
  var o = raw;
  if (typeof o === 'string') {
    var t = o.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    var start = t.indexOf('{'), end = t.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { o = JSON.parse(t.slice(start, end + 1)); } catch (eJson) { return null; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (o.fields && typeof o.fields === 'object' && !Array.isArray(o.fields)) o = o.fields;
  var out = {};
  function text(v, n) {
    if (v == null) return '';
    return String(v).replace(/[ \t]+/g, ' ').trim().slice(0, n || 400);
  }
  function put(k, v, n) {
    var s = text(v, n);
    if (s) out[k] = s;
  }
  put('name', o.name || o.customer || o.customerName, 120);
  put('phone', o.phone || o.customerPhone, 40);
  put('email', o.email || o.customerEmail, 120);
  put('address', o.address || o.customerAddress, 200);
  var sqRaw = o.sqft != null ? o.sqft : (o.squareFeet != null ? o.squareFeet : o.sqFt);
  if (sqRaw != null && String(sqRaw).trim() !== '') {
    var nsq = Number(String(sqRaw).replace(/[^0-9.]/g, ''));
    if (!isNaN(nsq) && nsq > 0 && nsq < 1000000) out.sqft = Math.round(nsq);
  }
  put('system', o.system || o.coating || o.coatingType, 80);
  put('color', o.color || o.flake || o.flakeColor, 80);
  var prep = o.prep != null ? o.prep : o.preparation;
  if (Array.isArray(prep)) prep = prep.map(function (x) { return text(x, 60); }).filter(Boolean).join(', ');
  put('prep', prep, 240);
  put('cure', o.cure || o.returnToService, 80);
  var rateRaw = o.rate != null ? o.rate : (o.pricePerSqft != null ? o.pricePerSqft : (o.pricePerSqFt != null ? o.pricePerSqFt : o.pricePerSquareFoot));
  if (rateRaw != null && String(rateRaw).trim() !== '') {
    var nr = Number(String(rateRaw).replace(/[^0-9.]/g, ''));
    if (!isNaN(nr) && nr > 0 && nr < 10000) out.rate = Math.round(nr * 100) / 100;
  }
  put('timeline', o.timeline, 160);
  put('notes', o.notes, 800);
  var extras = o.extras != null ? o.extras : (o.extra != null ? o.extra : o.addOns);
  if (Array.isArray(extras)) {
    var lines = extras.map(function (x) {
      if (x == null) return '';
      if (typeof x !== 'object') return text(x, 200);
      var title = text(x.title || x.name, 120);
      var detail = text(x.detail || '', 200);
      var price = (x.price == null || x.price === '') ? '' : text(x.price, 20);
      return [title, detail, price].filter(Boolean).join(' - ');
    }).filter(Boolean);
    if (lines.length) out.extras = lines.join('\n').slice(0, 800);
  } else put('extras', extras, 800);
  var jobType = snapJobType_(o.jobType || o.job || o.place || '');
  if (jobType) out.jobType = jobType;
  var system = snapList_(o.system || o.coating || o.coatingType || out.system, FILL_SYSTEMS);
  if (system) out.system = system;
  var color = snapColor_(o.color || o.flake || o.flakeColor || out.color);
  if (color) out.color = color;
  var prep = snapPrep_(o.prep != null ? o.prep : (out.prep || ''));
  if (prep) out.prep = prep;
  var cure = snapList_(o.cure || o.returnToService || out.cure, FILL_CURES);
  if (cure) out.cure = cure;
  var hard = hardnessVal_(o.hardness);
  if (hard) out.hardness = hard;
  if (Array.isArray(o.items)) {
    var lines = o.items.map(function (x) {
      if (!x || typeof x !== 'object') return null;
      var title = text(x.title || x.name, 160);
      if (!title) return null;
      var price = (x.price == null || x.price === '') ? null : Number(String(x.price).replace(/[^0-9.\-]/g, ''));
      if (price != null && isNaN(price)) price = null;
      return { title: title, detail: text(x.detail || '', 400), price: price };
    }).filter(Boolean).slice(0, 20);
    if (lines.length) out.items = lines;
  }
  return Object.keys(out).length ? out : null;
}
var FILL_SYSTEMS = ['Garage floor flake system', 'Full Flake Broadcast System', 'Acid Stain and Seal', 'Grind and Seal', 'Metallic epoxy', 'Solid color epoxy', 'Polyaspartic system', 'Polyurea garage system', 'Quartz broadcast', 'Pool deck coating', 'Patio and porch coating', 'Commercial kitchen floor', 'Warehouse / industrial floor', 'Concrete sealing', 'Grind and prep only', 'Crack and spall repair'];
var FILL_PREPS = ['Diamond grinding', 'Crack repair', 'Spall / patch repair', 'Moisture mitigation', 'Oil stain treatment', 'Joint fill', 'Coating removal'];
var FILL_CURES = ['Same-day return', '24 hours', '48 hours', '72 hours', '5-7 days'];
var FILL_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20 };
function fillWord_(w) {
  var s = String(w || '').toLowerCase();
  if (FILL_NUM[s] != null) return FILL_NUM[s];
  var n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}
function normWords_(s) {
  return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}
function snapList_(value, list) {
  var v = normWords_(value);
  if (!v || !list) return '';
  var i, best = '', score = 0;
  for (i = 0; i < list.length; i++) {
    var n = normWords_(list[i]);
    if (n === v) return list[i];
    var as = v.split(' '), bs = n.split(' '), s = 0, k;
    for (k = 0; k < as.length; k++) if (as[k].length > 2 && bs.indexOf(as[k]) >= 0) s++;
    if (n.indexOf(v) >= 0 || v.indexOf(n) >= 0) s += 2;
    if (s > score) { score = s; best = list[i]; }
  }
  return score ? best : '';
}
function snapColor_(value) {
  var raw = String(value || '').replace(/\s+/g, ' ').trim();
  var flat = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!flat) return '';
  if (flat.indexOf('wolf') >= 0 && flat.indexOf('gr') >= 0) return 'Wolf Gray';
  if (flat.indexOf('dominion') >= 0) return 'Dominion';
  return raw.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }).slice(0, 80);
}
function snapPrep_(value) {
  var src = Array.isArray(value) ? value.join(', ') : String(value || '');
  var low = src.toLowerCase();
  var out = [];
  var rules = [
    [/diamond\s*grind|\bgrind/, 'Diamond grinding'],
    [/crack/, 'Crack repair'],
    [/spall|\bpatch/, 'Spall / patch repair'],
    [/moisture|vapor/, 'Moisture mitigation'],
    [/\boil\b/, 'Oil stain treatment'],
    [/joint/, 'Joint fill'],
    [/removal|strip/, 'Coating removal']
  ];
  var i;
  for (i = 0; i < rules.length; i++) if (rules[i][0].test(low) && out.indexOf(rules[i][1]) < 0) out.push(rules[i][1]);
  if (!out.length) {
    var snapped = snapList_(src, FILL_PREPS);
    if (snapped) out.push(snapped);
  }
  return out.join(', ');
}
function snapJobType_(value) {
  var low = String(value || '').toLowerCase();
  if (/commercial|warehouse|shop|store|industrial/.test(low)) return 'Commercial';
  if (/house|home|residential/.test(low)) return 'Residential';
  return '';
}
function speechItems_(o) {
  var items = [];
  var sq = Number(o.sqft), rate = Number(o.rate);
  if (o.system) {
    var title = o.system + (sq ? ' — ' + sq + ' sq ft' : '');
    var detail = [];
    if (o.color) detail.push('Color / flake: ' + o.color + '.');
    if (o.prep) detail.push('Prep: ' + o.prep + '.');
    if (sq && rate) detail.push(sq + ' sq ft at $' + rate.toFixed(2) + ' per sq ft.');
    items.push({ title: title, detail: detail.join(' '), price: (sq > 0 && rate > 0) ? Math.round(sq * rate * 100) / 100 : null });
  }
  String(o.prep || '').split(',').forEach(function (p) {
    p = p.trim();
    if (p) items.push({ title: p, detail: p + '.', price: null });
  });
  return items;
}
function interpretSpeech_(text) {
  var raw = String(text || '').replace(/\s+/g, ' ').trim();
  var low = raw.toLowerCase();
  var out = {};
  if (!raw) return out;
  var sq = raw.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*-?\s*ft|sqft|square\s*feet|sq\.?\s*feet|\bsf\b)/i);
  if (!sq) sq = raw.match(/\b(\d[\d,]*)\s*ft\b/i);
  if (sq) {
    var nsq = parseFloat(sq[1].replace(/,/g, ''));
    if (nsq >= 40 && nsq < 1000000) out.sqft = Math.round(nsq);
  }
  if (/acid\s*stain/.test(low)) out.system = 'Acid Stain and Seal';
  else if (/grind and seal|grind & seal/.test(low)) out.system = 'Grind and Seal';
  else if (/grind and prep only|grind & prep|prep only/.test(low)) out.system = 'Grind and prep only';
  else if (/full\s+flake\s+broadcast|full[-\s]?broadcast/.test(low)) out.system = 'Full Flake Broadcast System';
  else if (/polyaspartic/.test(low)) out.system = 'Polyaspartic system';
  else if (/polyurea/.test(low)) out.system = 'Polyurea garage system';
  else if (/\bmetallic\b/.test(low)) out.system = 'Metallic epoxy';
  else if (/\bquartz\b/.test(low)) out.system = 'Quartz broadcast';
  else if (/pool\s*deck/.test(low)) out.system = 'Pool deck coating';
  else if (/\bkitchen\b/.test(low)) out.system = 'Commercial kitchen floor';
  else if (/warehouse|industrial/.test(low)) out.system = 'Warehouse / industrial floor';
  else if (/\bpatio\b|\bporch\b/.test(low)) out.system = 'Patio and porch coating';
  else if (/\bflake\b|\bchip\b/.test(low) && !/color flake|flake color|flake will be/.test(low)) out.system = 'Garage floor flake system';
  else if (/\bseal/.test(low)) out.system = 'Concrete sealing';
  else if (/\bsolid\b/.test(low)) out.system = 'Solid color epoxy';
  if (/wolf\s*gr[ae]y/.test(low)) out.color = 'Wolf Gray';
  else if (/\bdominion\b/.test(low)) out.color = 'Dominion';
  var prep = snapPrep_(low);
  if (prep) out.prep = prep;
  var rateTail = low.split(/per\s+square\s+foot|price\s+per\s+square|a\s+square\s+foot/);
  var rateM = null;
  if (rateTail.length > 1) {
    var rateChunk = rateTail.slice(1).join(' ').split(/\b(?:hardness|harness|mohs)\b/)[0];
    var rateWords = rateChunk.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\b/g);
    if (rateWords && rateWords.length) rateM = [null, rateWords[rateWords.length - 1]];
  }
  if (!rateM) rateM = low.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\s*(?:dollars|bucks)?\s*(?:per|a)\s+(?:square\s+foot|sq(?:uare)?\.?\s*ft)/);
  if (rateM) {
    var nr = fillWord_(rateM[1]);
    if (nr > 0 && nr < 10000) out.rate = Math.round(nr * 100) / 100;
  }
  var hardM = low.match(/(?:hardnes+|harness|mohs)\D{0,24}(one|two|three|four|five|six|seven|eight|nine|ten|\d+)/);
  if (hardM) {
    var nh = fillWord_(hardM[1]);
    if (nh >= 1 && nh <= 10 && nh === Math.floor(nh)) out.hardness = nh;
  }
  var jt = snapJobType_(low);
  if (jt) out.jobType = jt;
  if (out.system || out.prep) out.items = speechItems_(out);
  return out;
}
function mergeFill_(base, extra) {
  var out = extra || {};
  var k;
  base = base || {};
  for (k in base) if (base[k] != null && base[k] !== '' && (out[k] == null || out[k] === '' || (k === 'items' && (!out.items || !out.items.length)))) out[k] = base[k];
  if ((!out.items || !out.items.length) && (out.system || out.prep)) out.items = speechItems_(out);
  return out;
}
function fillCount_(o) {
  var n = 0;
  ['name', 'phone', 'email', 'address', 'sqft', 'jobType', 'system', 'color', 'prep', 'cure', 'rate', 'notes', 'hardness'].forEach(function (k) {
    if (o && o[k] != null && String(o[k]).trim() !== '') n++;
  });
  if (o && o.items && o.items.length) n++;
  else if (o && o.extras) n++;
  return n;
}
function fillReady_(fields) {
  var n = fillCount_(fields);
  if (!n) return { ok: true, ready: false, message: 'Could not fill that in. The notes on this phone were used instead.' };
  return { ok: true, ready: true, filled: n, fields: fields };
}
function quoteFill_(text) {
  // GEMINI_API_KEY and optional GEMINI_MODEL are Script Properties. Never paste the key into this file.
  var spoken = String(text || '').trim();
  if (!spoken) return { ok: true, ready: false, message: 'Say or type the job first.' };
  spoken = spoken.slice(0, 8000);
  var form = normalizeForm(settings_().form);
  FILL_SYSTEMS = form.systems.map(function (s) { return s.name; });
  FILL_PREPS = form.addons.map(function (a) { return a.name; });
  var colorList = form.colors.join(', ') || 'Wolf Gray, Dominion';
  var local = interpretSpeech_(spoken);
  var key = scriptProp_('GEMINI_API_KEY');
  if (!key) return fillReady_(local).ready ? fillReady_(local) : { ok: true, ready: false, message: 'AI fill not set up yet' };
  var prompt = 'You turn a contractor spoken note into a concrete coating estimate. The note may contain speech-to-text mistakes. Fix those before you answer. cutting means coating. harness means hardness, a Mohs number from 1 to 10. A floor size given in ft is square feet unless they say long, wide, or door. Return one JSON object and nothing else. Keys you may use: name, phone, email, address, sqft, jobType, system, color, prep, cure, rate, items, notes, hardness. sqft, rate, and hardness are numbers. jobType is Residential or Commercial. A house or home is Residential. system must be exactly one of: ' + FILL_SYSTEMS.join('; ') + '. prep is a comma-separated list using only: ' + FILL_PREPS.join('; ') + '. cure, when you know it, is exactly one of: ' + FILL_CURES.join('; ') + '. color is the flake or coating color with spelling corrected. Real color names: ' + colorList + '. items is an array of objects with title, detail, and price. price is a number, or null when the line is included. Include the main system line, and a separate line for each prep add-on such as crack repair and diamond grinding. When sqft and rate are both known, the main line price is sqft times rate. notes is optional customer-facing additional text with no price. Omit notes when the customer does not need extra text. Omit any key you cannot tell. Do not invent a phone or email. Never put hardness, a Mohs number, or private notes into notes or items.';
  prompt += '\n\nSpoken note:\n' + spoken;
  var gotFetch = geminiGenerate_(key, [{ text: prompt }]);
  if (!gotFetch || gotFetch.code < 200 || gotFetch.code >= 300) return fillReady_(local);
  var parsed;
  try { parsed = JSON.parse(gotFetch.body); } catch (eParse) { return fillReady_(local); }
  var got = normalizeFill_(geminiText_(parsed));
  return fillReady_(mergeFill_(local, got || {}));
}
function aiDebug_() {
  var key = scriptProp_('GEMINI_API_KEY');
  if (!key) return { ok: true, ready: false, message: 'AI fill not set up yet', tries: [] };
  var primary = geminiModel_();
  var models = [primary];
  if (primary !== 'gemini-flash-latest') models.push('gemini-flash-latest');
  var tries = [];
  var i;
  for (i = 0; i < models.length; i++) {
    var got = geminiFetch_(key, models[i], [{ text: 'Reply with JSON {"ok":true}.' }]);
    var code = got && got.code ? got.code : 0;
    var err = (code >= 200 && code < 300) ? '' : clipErr_(got && got.body, key);
    tries.push({ model: models[i], code: code, error: err });
  }
  return { ok: true, tries: tries };
}
function saveReceiptImage_(image) {
  var parts = String(image || '').split(',');
  if (parts.length < 2 || !parts[1]) throw new Error('No receipt photo');
  var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), 'image/jpeg', 'receipt-' + Date.now() + '.jpg');
  return receiptsFolder_().createFile(blob).getId();
}
var RECEIPT_CATS = ['Fuel', 'Equipment repair', 'Equipment rental', 'Tools & equipment', 'Parts & supplies', 'Meals', 'Subcontractors', 'Labor', 'Insurance', 'Dump fees', 'Vehicle', 'Advertising', 'Office', 'Other'];
function normalizeReceipt_(raw) {
  var o = raw;
  if (typeof o === 'string') {
    var t = o.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    var start = t.indexOf('{'), end = t.lastIndexOf('}');
    if (start < 0 || end <= start) return {};
    try { o = JSON.parse(t.slice(start, end + 1)); } catch (eR) { return {}; }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  var data = {};
  var vendor = String(o.vendor || o.merchant || o.store || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (vendor) data.vendor = vendor;
  var date = String(o.date || '').trim();
  var dm = date.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!dm) {
    var us = date.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (us) {
      var y = us[3].length === 2 ? '20' + us[3] : us[3];
      date = y + '-' + ('0' + us[1]).slice(-2) + '-' + ('0' + us[2]).slice(-2);
      dm = date.match(/(\d{4})-(\d{2})-(\d{2})/);
    }
  }
  if (dm) data.date = dm[0];
  function moneyOrNull(v) {
    if (v == null || String(v).trim() === '') return null;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    if (isNaN(n)) return null;
    return Math.round(n * 100) / 100;
  }
  var total = moneyOrNull(o.total != null ? o.total : o.amount);
  if (total != null && total > 0) data.total = total;
  if (o.tax != null && String(o.tax).trim() !== '') {
    var tax = moneyOrNull(o.tax);
    if (tax != null) data.tax = tax;
  }
  var cat = snapList_(o.category || '', RECEIPT_CATS) || 'Other';
  if (o.category) data.category = cat;
  return data;
}
function receiptImagePart_(image) {
  var s = String(image || '');
  var m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m || m[2].replace(/\s/g, '').length > 2000000) return null;
  return { inline_data: { mime_type: m[1], data: m[2].replace(/\s/g, '') } };
}
function readReceipt_(image) {
  var key = scriptProp_('GEMINI_API_KEY');
  var part = receiptImagePart_(image);
  if (!key || !part) return { ocr: false, reason: 'miss', data: {} };
  var prompt = 'Read this receipt. Return one JSON object and nothing else. Keys: vendor, date, total, tax, category. date is YYYY-MM-DD. total and tax are numbers. tax may be null. category is exactly one of: ' + RECEIPT_CATS.join('; ') + '. Omit a key you cannot see. Do not invent amounts.';
  var got = geminiGenerate_(key, [{ text: prompt }, part]);
  if (!got || got.code < 200 || got.code >= 300) return { ocr: false, reason: 'miss', data: {} };
  var parsed;
  try { parsed = JSON.parse(got.body); } catch (eParse) { return { ocr: false, reason: 'miss', data: {} }; }
  var data = normalizeReceipt_(geminiText_(parsed));
  if (!data.vendor && data.total == null && !data.date) return { ocr: false, reason: 'miss', data: {} };
  return { ocr: true, reason: '', data: data };
}
function scanReceipt_(image) {
  var id = saveReceiptImage_(image);
  var read;
  try { read = readReceipt_(image); } catch (eRead) { read = { ocr: false, reason: 'miss', data: {} }; }
  return { ok: true, receiptId: id, ocr: !!read.ocr, reason: read.ocr ? '' : 'miss', data: read.data || {} };
}
function rescanReceipt_(id) {
  var read = { ocr: false, reason: 'miss', data: {} };
  try {
    var b = DriveApp.getFileById(id).getBlob();
    var url = 'data:' + (b.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(b.getBytes());
    read = readReceipt_(url);
  } catch (eRescan) {}
  return { ok: true, receiptId: id || '', ocr: !!read.ocr, reason: read.ocr ? '' : 'miss', data: read.data || {} };
}
function feedbackAddr_() {
  return scriptProp_('FEEDBACK_EMAIL') || 'austin@techsourcedsolutions.com';
}
function mailFeedback_(row) {
  try {
    var when = Utilities.formatDate(new Date(row.at || new Date()), 'America/New_York', 'MMMM d, yyyy h:mm a');
    var text = String(row.text || '');
    var who = String(row.role || '');
    var plain = 'Feedback\n\n' + text + '\n\nRole: ' + who + '\nTime: ' + when + ' Eastern';
    sendMail_({
      job: { email: feedbackAddr_() },
      name: 'Southern Concrete Coatings',
      subject: 'Southern Concrete Coatings app feedback',
      body: plain,
      html: '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#212020"><p style="white-space:pre-wrap">' + escHtml(text) + '</p><p><b>Role:</b> ' + escHtml(who) + '<br><b>Time:</b> ' + escHtml(when) + ' Eastern</p></div>'
    });
  } catch (eMail) {}
}
function sendReview_(j) {
  customerOk_(j);
  if (!settings_().reviewLink) throw new Error('Add a Google review link in Settings first.');
  sendMail_({
    job: j,
    subject: 'How did we do? Southern Concrete Coatings',
    html: reviewEmailHtml(mailOpts_(j)),
    inlineImages: { logo: logoBlob_() }
  });
}
function mileRate_(v) {
  if (v == null || v === '') return 0.70;
  var n = Number(v);
  if (isNaN(n) || n < 0 || n > 100) return 0.70;
  return Math.round(n * 1000) / 1000;
}
function mileage_() {
  var list = load_('mileage.json');
  return Array.isArray(list) ? list : [];
}
function qboEnv_() {
  var e = String(scriptProp_('QBO_ENV') || 'sandbox').toLowerCase();
  return e === 'production' ? 'production' : 'sandbox';
}
function qboRedirect_() { return ScriptApp.getService().getUrl(); }
function qboLoad_() {
  var o = loadObj_('qbo.json');
  if (!o.refreshToken || !o.realmId) return null;
  return o;
}
function qboPublic_() {
  var o = loadObj_('qbo.json');
  return { connected: !!(o.refreshToken && o.realmId), env: o.env || qboEnv_() };
}
function qboSave_(o) { save_(o || {}, 'qbo.json'); }
function qboApiBase_() {
  return qboEnv_() === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
}
function qboBasic_() {
  return Utilities.base64Encode(scriptProp_('QBO_CLIENT_ID') + ':' + scriptProp_('QBO_CLIENT_SECRET'));
}
function qboExchange_(body) {
  var res = UrlFetchApp.fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'post', contentType: 'application/x-www-form-urlencoded', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + qboBasic_(), Accept: 'application/json' }, payload: body
  });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) throw new Error('QuickBooks auth failed');
  return JSON.parse(res.getContentText() || '{}');
}
function qboApplyTok_(cur, tok, realm) {
  cur = cur || {};
  cur.accessToken = tok.access_token;
  if (tok.refresh_token) cur.refreshToken = tok.refresh_token;
  cur.accessExp = Date.now() + (Number(tok.expires_in) || 3000) * 1000 - 60000;
  if (realm) cur.realmId = realm;
  cur.env = qboEnv_();
  qboSave_(cur);
  return cur;
}
function qboConnectUrl_() {
  var id = scriptProp_('QBO_CLIENT_ID'), sec = scriptProp_('QBO_CLIENT_SECRET');
  if (!id || !sec) return '';
  var state = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('QBO_STATE', state);
  return 'https://appcenter.intuit.com/connect/oauth2?client_id=' + encodeURIComponent(id) + '&response_type=code&scope=' + encodeURIComponent('com.intuit.quickbooks.accounting') + '&redirect_uri=' + encodeURIComponent(qboRedirect_()) + '&state=' + encodeURIComponent(state);
}
function qboFinish_(p) {
  var expect = '';
  try { expect = PropertiesService.getScriptProperties().getProperty('QBO_STATE') || ''; } catch (eSt) {}
  if (!p.code || !p.state || p.state !== expect) return page_('<h2>QuickBooks</h2><p>That connection link was not valid. Use Connect in Settings again.</p>');
  try { PropertiesService.getScriptProperties().deleteProperty('QBO_STATE'); } catch (eDel) {}
  try { qboApplyTok_({}, qboExchange_('grant_type=authorization_code&code=' + encodeURIComponent(p.code) + '&redirect_uri=' + encodeURIComponent(qboRedirect_())), p.realmId); }
  catch (eFin) { return page_('<h2>QuickBooks</h2><p>Could not finish connecting. Check the Intuit keys and try again.</p>'); }
  return page_('<h2>QuickBooks connected</h2><p>You can close this tab and return to the app.</p><p><a href="https://austin-tss.github.io/southern-concrete/">Back to Southern Concrete Coatings</a></p>');
}
function qboAccess_() {
  var cur = qboLoad_();
  if (!cur) return null;
  if (cur.accessToken && cur.accessExp && Date.now() < Number(cur.accessExp)) return cur;
  return qboApplyTok_(cur, qboExchange_('grant_type=refresh_token&refresh_token=' + encodeURIComponent(cur.refreshToken)), cur.realmId);
}
function qboFetch_(method, path, payload) {
  var cur = qboAccess_();
  if (!cur) return null;
  var url = qboApiBase_() + '/v3/company/' + encodeURIComponent(cur.realmId) + path + (String(path).indexOf('?') >= 0 ? '&' : '?') + 'minorversion=75';
  var opt = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + cur.accessToken, Accept: 'application/json' } };
  if (payload) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(payload); }
  var res = UrlFetchApp.fetch(url, opt);
  if (res.getResponseCode() === 401) {
    cur.accessExp = 0;
    qboSave_(cur);
    cur = qboAccess_();
    if (!cur) return null;
    opt.headers.Authorization = 'Bearer ' + cur.accessToken;
    res = UrlFetchApp.fetch(url, opt);
  }
  var body = {};
  try { body = JSON.parse(res.getContentText() || '{}'); } catch (eJ) {}
  return { code: res.getResponseCode(), body: body };
}
function qboQuery_(q) {
  var got = qboFetch_('get', '/query?query=' + encodeURIComponent(q));
  return (got && got.body && got.body.QueryResponse) || {};
}
function qboEnsureItem_() {
  var cur = qboLoad_();
  if (!cur) return '';
  if (cur.itemId) return String(cur.itemId);
  var rows = qboQuery_("select * from Item where Name = 'Concrete coating'").Item || [];
  if (rows.length) { cur.itemId = rows[0].Id; qboSave_(cur); return String(cur.itemId); }
  var made = qboFetch_('post', '/item', { Name: 'Concrete coating', Type: 'Service' });
  var id = made && made.body && made.body.Item && made.body.Item.Id;
  if (id) { cur.itemId = id; qboSave_(cur); }
  return id ? String(id) : '';
}
function qboEnsureAccount_(kind) {
  var cur = qboLoad_();
  if (!cur) return '';
  var key = kind === 'pay' ? 'payAccountId' : 'expAccountId';
  if (cur[key]) return String(cur[key]);
  var q = kind === 'pay' ? "select * from Account where AccountType = 'Bank' maxresults 1" : "select * from Account where AccountType = 'Expense' maxresults 1";
  var rows = qboQuery_(q).Account || [];
  if (!rows.length) return '';
  cur[key] = rows[0].Id;
  qboSave_(cur);
  return String(cur[key]);
}
function qboCustomer_(j) {
  if (!j || !qboLoad_()) return;
  var name = String(j.name || 'Customer').trim().slice(0, 100) || 'Customer';
  var payload = { DisplayName: name };
  if (j.email) payload.PrimaryEmailAddr = { Address: String(j.email).slice(0, 100) };
  if (j.phone) payload.PrimaryPhone = { FreeFormNumber: String(j.phone).slice(0, 30) };
  if (j.address) payload.BillAddr = { Line1: String(j.address).slice(0, 400) };
  if (j.qboCustomerId) {
    var got = qboFetch_('get', '/customer/' + encodeURIComponent(j.qboCustomerId));
    var row = got && got.body && got.body.Customer;
    if (row) {
      payload.Id = row.Id; payload.SyncToken = row.SyncToken; payload.sparse = true;
      var upd = qboFetch_('post', '/customer', payload);
      if (upd && upd.code >= 200 && upd.code < 300) return;
    }
  }
  var made = qboFetch_('post', '/customer', payload);
  var id = made && made.body && made.body.Customer && made.body.Customer.Id;
  if (!id) {
    var safe = name.replace(/'/g, '');
    var found = qboQuery_("select * from Customer where DisplayName = '" + safe + "'").Customer || [];
    if (found.length) id = found[0].Id;
  }
  if (id) j.qboCustomerId = id;
}
function qboLines_(j) {
  var item = qboEnsureItem_() || '1';
  var items = (j.items || []).filter(function (it) { return it && it.title && !it.internal; });
  if (!items.length) items = [{ title: j.system || 'Coating', price: j.total || 0 }];
  return items.map(function (it) {
    var amt = it.price == null || it.price === '' ? 0 : Number(it.price) || 0;
    return { DetailType: 'SalesItemLineDetail', Amount: amt, Description: String(it.title).slice(0, 4000), SalesItemLineDetail: { ItemRef: { value: String(item) }, Qty: 1, UnitPrice: amt } };
  });
}
function qboDoc_(j, kind) {
  if (!j || !qboLoad_()) return;
  qboCustomer_(j);
  if (!j.qboCustomerId) return;
  var idKey = kind === 'invoice' ? 'qboInvoiceId' : 'qboEstimateId';
  var path = kind === 'invoice' ? '/invoice' : '/estimate';
  var key = kind === 'invoice' ? 'Invoice' : 'Estimate';
  var payload = { CustomerRef: { value: String(j.qboCustomerId) }, Line: qboLines_(j) };
  if (kind === 'estimate' && j.est) payload.DocNumber = String(j.est).slice(0, 21);
  if (j[idKey]) {
    var got = qboFetch_('get', path + '/' + encodeURIComponent(j[idKey]));
    var row = got && got.body && got.body[key];
    if (row) { payload.Id = row.Id; payload.SyncToken = row.SyncToken; payload.sparse = true; }
  }
  var made = qboFetch_('post', path, payload);
  var id = made && made.body && made.body[key] && made.body[key].Id;
  if (id) j[idKey] = id;
}
function qboPurchase_(ex) {
  if (!ex || !qboLoad_()) return;
  var pay = qboEnsureAccount_('pay'), expA = qboEnsureAccount_('exp');
  if (!pay || !expA) return;
  var payload = { PaymentType: 'Cash', AccountRef: { value: String(pay) }, Line: [{ Amount: Number(ex.amount) || 0, DetailType: 'AccountBasedExpenseLineDetail', Description: String(ex.vendor || ex.category || 'Receipt').slice(0, 400), AccountBasedExpenseLineDetail: { AccountRef: { value: String(expA) } } }] };
  if (ex.qboPurchaseId) {
    var got = qboFetch_('get', '/purchase/' + encodeURIComponent(ex.qboPurchaseId));
    var row = got && got.body && got.body.Purchase;
    if (row) { payload.Id = row.Id; payload.SyncToken = row.SyncToken; payload.sparse = true; }
  }
  var made = qboFetch_('post', '/purchase', payload);
  var id = made && made.body && made.body.Purchase && made.body.Purchase.Id;
  if (id) ex.qboPurchaseId = id;
}
function qboQuietJob_(kind, j) { try { if (qboLoad_()) qboDoc_(j, kind); } catch (eQ) {} }
function qboQuietExp_(ex) { try { if (qboLoad_()) qboPurchase_(ex); } catch (eQ) {} }
function qboQuietCustomers_(list) { try { if (!qboLoad_()) return; (list || []).forEach(qboCustomer_); } catch (eQ) {} }
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.a === 'twvoice') return twvoice_(p);
  if (p.code && p.state) return qboFinish_(p);
  if (p.a === 'logins') return out_({ ok: true, logins: load_('logins.json') });
  if (p.a === 'feedback') {
    var fbGet = load_('feedback.json');
    if (!Array.isArray(fbGet)) fbGet = [];
    return out_({ ok: true, feedback: fbGet.map(function (row) {
      return { at: String(row && row.at || ''), role: String(row && row.role || ''), text: String(row && row.text || '') };
    }) });
  }
  if (p.a === 'img' && p.id) {
    var b = DriveApp.getFileById(p.id).getBlob();
    return out_({ ok: true, data: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) });
  }
  if (p.a === 'respond') {
    var js = load_(), j = js.filter(function (x) { return x.id === p.id; })[0];
    if (!j) return page_('<h2>Estimate not found</h2><p>Please call ' + CO.phone + '.</p>');
    if (p.ans !== 'C' && !p.done) {
      return page_(responseFormHtml({
        co: CO, colors: COLORS, job: j, ans: p.ans, labels: LABELS, slots: SLOTS,
        action: ScriptApp.getService().getUrl()
      }));
    }
    var L = LockService.getScriptLock();
    L.waitLock(20000);
    try {
      js = load_();
      j = js.filter(function (x) { return x.id === p.id; })[0];
      respond_(j, p);
      save_(js);
    } finally { L.releaseLock(); }
    return page_(responseThanksHtml({ co: CO, colors: COLORS, job: j }));
  }
  return out_({ ok: true, test: TEST_MODE, testMode: TEST_MODE, testTo: TEST_MODE ? TEST_TO : '', root: root_().getUrl(), jobs: load_(), blocks: load_('blocks.json'), settings: settings_(), gallery: gallery_(), callLog: callLog_().slice(0, 80) });
}
function numField_(v) {
  if (v == null || v === '') return '';
  var n = Number(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? '' : n;
}
function cleanItems_(list) {
  var out = [], arr = Array.isArray(list) ? list : [], i;
  for (i = 0; i < arr.length && out.length < 40; i++) {
    var it = arr[i] || {};
    var title = String(it.title || '').trim().slice(0, 200);
    if (!title) continue;
    var detail = String(it.detail || '').replace(/\u0000/g, '').trim().slice(0, 2000);
    var price = null;
    if (it.price != null && String(it.price).trim() !== '') {
      var n = Number(String(it.price).replace(/[$,]/g, ''));
      if (!isNaN(n)) price = Math.round(n * 100) / 100;
    }
    out.push({ title: title, detail: detail, price: price, internal: !!it.internal });
  }
  return out;
}
function doPost(e) {
  var peek = (e && e.parameter) || {};
  if (peek.a === 'twvoice') return twvoice_(peek);
  var d = JSON.parse(e.postData.contents);
  if (d && d.a === 'twvoice') return twvoice_(d);
  var L = LockService.getScriptLock();
  L.waitLock(30000);
  var j, send = null, js;
  try {
    if (d.a === 'signin') {
      var lg = load_('logins.json');
      lg.push({ t: new Date().toISOString(), role: String(d.role || ''), ua: String(d.ua || '').slice(0, 200) });
      if (lg.length > 500) lg = lg.slice(-500);
      save_(lg, 'logins.json');
      return out_({ ok: true });
    }
    if (d.a === 'log') {
      var act = load_('activity.json');
      if (!Array.isArray(act)) act = [];
      act.push({ t: new Date().toISOString(), what: String(d.what || '').slice(0, 200), role: String(d.role || ''), ua: String(d.ua || '').slice(0, 200) });
      if (act.length > 500) act = act.slice(-500);
      save_(act, 'activity.json');
      return out_({ ok: true });
    }
    if (d.a === 'gadd') {
      var parts = String(d.image || '').split(',');
      if (parts.length < 2 || !parts[1]) return out_({ ok: false, err: 'Choose a photo first' });
      var cap = String(d.caption || '').trim().slice(0, 200);
      var tags = String(d.tags || '').split(',').map(function (s) { return s.trim().slice(0, 40); }).filter(Boolean).slice(0, 12);
      var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), 'image/jpeg', 'gallery-' + Date.now() + '.jpg');
      var file = galleryFolder_().createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var list = gallery_();
      list.unshift({
        id: file.getId(),
        caption: cap,
        tags: tags,
        t: new Date().toISOString(),
        url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600'
      });
      if (list.length > 400) list = list.slice(0, 400);
      save_(list, 'gallery.json');
      return out_({ ok: true, gallery: list });
    }
    if (d.a === 'gdel') {
      var before = gallery_();
      var had = before.some(function (x) { return x.id === d.id; });
      var left = before.filter(function (x) { return x.id !== d.id; });
      if (had && d.id) { try { DriveApp.getFileById(d.id).setTrashed(true); } catch (eG) {} }
      save_(left, 'gallery.json');
      return out_({ ok: true, gallery: left });
    }
    if (d.a === 'measure') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      return out_(measureFloor_(d.images || d.photos, d.known));
    }
    if (d.a === 'qfill') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      return out_(quoteFill_(d.text));
    }
    if (d.a === 'aidebug') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      return out_(aiDebug_());
    }
    if (d.a === 'qboconnect') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      var qUrl = qboConnectUrl_();
      if (!qUrl) return out_({ ok: false, err: 'Add QBO_CLIENT_ID and QBO_CLIENT_SECRET in Script Properties.' });
      return out_({ ok: true, url: qUrl });
    }
    if (d.a === 'qbodisconnect') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      qboSave_({});
      return out_({ ok: true, settings: settings_() });
    }
    if (d.a === 'milelist' || d.a === 'mileadd' || d.a === 'miledel' || d.a === 'cedit') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      if (d.a === 'milelist') return out_({ ok: true, trips: mileage_(), mileRate: settings_().mileRate });
      if (d.a === 'miledel') {
        save_(mileage_().filter(function (t) { return t.id !== d.id; }), 'mileage.json');
        return out_({ ok: true, trips: mileage_() });
      }
      if (d.a === 'mileadd') {
        var trips = mileage_();
        function optNum(v) { return v == null || String(v).trim() === '' ? '' : moneyNum_(v); }
        trips.unshift({
          id: 'MI' + Date.now().toString(36).toUpperCase(),
          date: String(d.date || Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd')).slice(0, 10),
          jobId: String(d.jobId || '').slice(0, 40),
          customer: String(d.customer || '').slice(0, 120),
          start: optNum(d.start), end: optNum(d.end), miles: optNum(d.miles),
          purpose: String(d.purpose || '').slice(0, 200),
          notes: String(d.notes || '').slice(0, 2000),
          created: new Date().toISOString()
        });
        save_(trips, 'mileage.json');
        return out_({ ok: true, trips: trips });
      }
      if (d.email && !validEmail(d.email)) return out_({ ok: false, err: 'That customer email does not look valid.' });
      var cids = d.ids || [];
      var cjs = load_();
      cjs.forEach(function (x) {
        if (cids.indexOf(x.id) < 0) return;
        x.name = String(d.name || '').trim().slice(0, 200);
        x.phone = String(d.phone || '').trim().slice(0, 40);
        x.email = String(d.email || '').trim();
        x.address = String(d.address || '').trim().slice(0, 300);
        x.phone2 = String(d.phone2 || '').trim().slice(0, 40);
        x.contact2 = String(d.contact2 || '').trim().slice(0, 120);
      });
      qboQuietCustomers_(cjs.filter(function (x) { return cids.indexOf(x.id) >= 0; }));
      save_(cjs);
      return out_({ ok: true });
    }
    if (d.a === 'feedback') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      var fbText = String(d.text || '').trim();
      if (!fbText) return out_({ ok: false, err: 'Write a note first' });
      var fbList = load_('feedback.json');
      if (!Array.isArray(fbList)) fbList = [];
      fbList.push({ at: new Date().toISOString(), role: String(d.role || '').slice(0, 40), text: fbText.slice(0, 4000) });
      if (fbList.length > 500) fbList = fbList.slice(-500);
      save_(fbList, 'feedback.json');
      mailFeedback_(fbList[fbList.length - 1]);
      return out_({ ok: true });
    }
    if (d.a === 'remindtest' || d.a === 'remindinstall' || d.a === 'remindnow' || d.a === 'textnow') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      if (d.a === 'remindinstall') {
        try { installReminderTrigger(); }
        catch (eInst) { return out_({ ok: false, err: String(eInst.message || eInst).slice(0, 180) }); }
        return out_({ ok: true, installed: true });
      }
      if (d.a === 'remindnow') return out_(remindNow_(d.ids));
      if (d.a === 'textnow') return out_(textNow_(d.ids));
      return out_(remindTest_(d.testPhone));
    }
    if (d.a === 'settings' || d.a === 'explist' || d.a === 'expadd' || d.a === 'expdel' || d.a === 'rcscan' || d.a === 'rcrescan' || d.a === 'rcdrop') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      if (d.a === 'settings') {
        var curS = loadObj_('settings.json');
        curS.payLink = String(d.payLink || '').trim();
        curS.reviewLink = String(d.reviewLink || '').trim();
        curS.finLink = String(d.finLink || '').trim();
        var fm = Number(String(d.finMin == null ? '' : d.finMin).replace(/[^0-9.\-]/g, ''));
        curS.finMin = isNaN(fm) ? 1000 : fm;
        if (typeof curS.ocr !== 'boolean') curS.ocr = true;
        if (d.form) curS.form = normalizeForm(d.form);
        if (d.mileRate != null && String(d.mileRate).trim() !== '') curS.mileRate = mileRate_(d.mileRate);
        if (d.theme === 'classic' || d.theme === 'dark') curS.theme = d.theme;
        curS.quoteBody = String(d.quoteBody || '').trim().slice(0, 4000);
        curS.quoteSubject = String(d.quoteSubject || '').trim().slice(0, 300);
        curS.quoteSign = String(d.quoteSign || '').trim().slice(0, 800);
        if (d.quoteBcc != null) curS.quoteBcc = quoteBcc_(d.quoteBcc);
        if (Array.isArray(d.galleryHide)) curS.galleryHide = galleryHide_(d.galleryHide);
        if (d.reminders && typeof d.reminders === 'object') {
          var postedR = d.reminders;
          if (!Array.isArray(postedR.questions) && curS.reminders && Array.isArray(curS.reminders.questions)) {
            postedR = { on: postedR.on, test: postedR.test, testPhone: postedR.testPhone, questions: curS.reminders.questions };
          }
          curS.reminders = reminderCfg_({ reminders: postedR });
        }
        if (d.texts && typeof d.texts === 'object') curS.texts = smsCfg_({ texts: d.texts, reminders: curS.reminders });
        save_(curS, 'settings.json');
        return out_({ ok: true, settings: settings_() });
      }
      if (d.a === 'explist') return out_({ ok: true, expenses: expenses_() });
      if (d.a === 'expadd') {
        var amt = moneyNum_(d.amount);
        if (!(amt > 0)) return out_({ ok: false, err: 'Enter the amount' });
        var ex = expenses_();
        var receipt = String(d.receiptId || '');
        if (!receipt && d.image) receipt = saveReceiptImage_(d.image);
        var tax = (d.tax == null || d.tax === '') ? null : moneyNum_(d.tax);
        ex.unshift({
          id: 'EX' + Date.now().toString(36).toUpperCase(),
          amount: amt,
          category: String(d.category || 'Other'),
          note: String(d.note || ''),
          date: String(d.date || Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd')),
          vendor: String(d.vendor || ''),
          tax: tax,
          items: d.items || [],
          receipt: receipt,
          scanned: !!d.scanned,
          created: new Date().toISOString()
        });
        try { qboQuietExp_(ex[0]); } catch (eQe) {}
        save_(ex, 'expenses.json');
        return out_({ ok: true, expenses: ex });
      }
      if (d.a === 'expdel') {
        var ex2 = expenses_().filter(function (x) { return x.id !== d.id; });
        save_(ex2, 'expenses.json');
        return out_({ ok: true, expenses: ex2 });
      }
      if (d.a === 'rcscan') return out_(scanReceipt_(d.image));
      if (d.a === 'rcrescan') return out_(rescanReceipt_(d.id));
      if (d.a === 'rcdrop') {
        if (d.id) { try { DriveApp.getFileById(d.id).setTrashed(true); } catch (eDrop) {} }
        return out_({ ok: true });
      }
    }
    js = load_();
    if (d.a === 'block' || d.a === 'unblock') {
      var bl = load_('blocks.json');
      bl = bl.filter(function (b) { return b.id !== d.block.id; });
      if (d.a === 'block') {
        if (!d.block.id) d.block.id = 'B' + Date.now().toString(36);
        bl.push(d.block);
      }
      save_(bl, 'blocks.json');
      return out_({ ok: true, blocks: bl, testMode: TEST_MODE });
    }
    if (d.a === 'delete') {
      if (!pinOk_(d)) return out_({ ok: false, err: 'Wrong PIN' });
      js = js.filter(function (x) { return x.id !== d.id; });
      save_(js);
      return out_({ ok: true });
    }
    if (d.a === 'phone') {
      var ids = d.ids || [];
      var ph = String(d.phone || '').trim();
      js.forEach(function (x) { if (ids.indexOf(x.id) >= 0) x.phone = ph; });
      save_(js);
      return out_({ ok: true });
    }
    if (d.a === 'create') {
      if (d.email && !validEmail(d.email)) return out_({ ok: false, err: 'That customer email does not look valid.' });
      if (hardnessVal_(d.hardness) === null) return out_({ ok: false, err: 'Hardness is a whole number from 1 to 10.' });
      var fields = { sqft: d.sqft, system: d.system, color: d.color, prep: d.prep, cure: d.cure, rate: d.rate };
      var items = (d.items && d.items.length) ? d.items : buildItems(fields, d.quote);
      j = {
        id: 'SCC-' + Date.now().toString(36).toUpperCase(),
        est: estNo_(),
        name: d.name,
        address: d.address,
        email: String(d.email || '').trim(),
        phone: String(d.phone || '').trim(),
        jobType: String(d.jobType || '').trim().slice(0, 40),
        custom: (d.custom && typeof d.custom === 'object' && !Array.isArray(d.custom)) ? d.custom : {},
        quote: d.quote || '',
        sqft: numField_(d.sqft),
        system: d.system || '',
        color: d.color || '',
        prep: d.prep || '',
        cure: d.cure || '',
        rate: numField_(d.rate),
        hardness: hardnessVal_(d.hardness),
        hardnessHow: String(d.hardnessHow || '').trim().slice(0, 300),
        internalNotes: [],
        additionalNotes: String(d.additionalNotes || '').trim().slice(0, 4000),
        items: items,
        total: totalOf(items),
        status: 'sent',
        created: new Date().toISOString(),
        photos: [],
        crew: []
      };
      folder_(j);
      j.photos = savePhotos_(j, d.photos, 'quote');
      js.unshift(j);
      send = sendQuote_;
    } else {
      j = js.filter(function (x) { return x.id === d.id; })[0];
      if (!j) return out_({ ok: false, err: 'Job not found' });
      if (d.a === 'upload') j.crew = (j.crew || []).concat(savePhotos_(j, d.photos, d.kind));
      else if (d.a === 'finish') {
        j.crewNotes = d.notes || '';
        j.status = 'complete';
        j.finished = new Date().toISOString();
        send = sendRecap_;
      } else if (d.a === 'invoice') {
        j.invoice = { amount: d.amount, note: d.note || '', at: new Date().toISOString(), paid: j.invoice && j.invoice.paid };
        j.status = 'invoiced';
        send = sendInvoice_;
      } else if (d.a === 'paid') {
        j.invoice = j.invoice || {};
        j.invoice.paid = !!d.paid;
        j.invoice.paidAt = d.paid ? new Date().toISOString() : '';
      } else if (d.a === 'email') {
        if (!validEmail(d.email)) return out_({ ok: false, err: 'Invalid email' });
        j.email = String(d.email).trim();
      } else if (d.a === 'respond') respond_(j, d);
      else if (d.a === 'hardness') {
        var hv = hardnessVal_(d.hardness);
        if (hv === null) return out_({ ok: false, err: 'Hardness is a whole number from 1 to 10.' });
        j.hardness = hv;
        j.hardnessHow = String(d.hardnessHow || '').trim().slice(0, 300);
      } else if (d.a === 'qedit') {
        if (d.email && !validEmail(d.email)) return out_({ ok: false, err: 'That customer email does not look valid.' });
        if (hardnessVal_(d.hardness) === null) return out_({ ok: false, err: 'Hardness is a whole number from 1 to 10.' });
        j.name = String(d.name || '').trim().slice(0, 200);
        j.address = String(d.address || '').trim().slice(0, 300);
        j.email = String(d.email || '').trim();
        j.phone = String(d.phone || '').trim().slice(0, 40);
        j.jobType = String(d.jobType || '').trim().slice(0, 40);
        j.custom = (d.custom && typeof d.custom === 'object' && !Array.isArray(d.custom)) ? d.custom : {};
        j.quote = String(d.quote || '').slice(0, 8000);
        j.sqft = numField_(d.sqft);
        j.system = String(d.system || '').trim().slice(0, 80);
        j.color = String(d.color || '').trim().slice(0, 80);
        j.prep = String(d.prep || '').trim().slice(0, 240);
        j.cure = String(d.cure || '').trim().slice(0, 80);
        j.rate = numField_(d.rate);
        j.hardness = hardnessVal_(d.hardness);
        j.hardnessHow = String(d.hardnessHow || '').trim().slice(0, 300);
        j.additionalNotes = String(d.additionalNotes || '').trim().slice(0, 4000);
        j.items = cleanItems_(d.items);
        j.total = totalOf(j.items);
        j.pdfId = '';
        j.updated = new Date().toISOString();
        try { makePdf_(j); } catch (ePdf) { j.pdf = ''; }
        if (d.send) send = sendQuote_;
      } else if (d.a === 'addl') {
        j.additionalNotes = String(d.additionalNotes != null ? d.additionalNotes : '').trim().slice(0, 4000);
        j.pdfId = '';
        try { makePdf_(j); } catch (ePdf) { j.pdf = ''; }
      } else if (d.a === 'inote') {
        var noteText = String(d.text || '').trim();
        if (!noteText) return out_({ ok: false, err: 'Write a note first' });
        if (!Array.isArray(j.internalNotes)) j.internalNotes = [];
        j.internalNotes.push({ t: new Date().toISOString(), text: noteText.slice(0, 2000) });
        if (j.internalNotes.length > 200) j.internalNotes = j.internalNotes.slice(-200);
      } else if (d.a === 'resend' || d.a === 'resendquote') {
        if (!j.est) return out_({ ok: false, err: 'This job has no quote to resend' });
        send = sendQuote_;
        j.resent = (j.resent || 0) + 1;
        j.resentAt = new Date().toISOString();
      } else if (d.a === 'markpaid') {
        j.invoice = j.invoice || {};
        j.invoice.paid = true;
        j.invoice.paidAt = new Date().toISOString();
        j.invoice.paidDate = String(d.date || '');
        j.invoice.method = String(d.method || '');
        j.invoice.amountPaid = moneyNum_(d.amount);
        j.invoice.ref = String(d.ref || '');
        if (!j.invoice.amount) j.invoice.amount = money(j.invoice.amountPaid);
        if (!j.invoice.at) j.invoice.at = j.invoice.paidAt;
        j.status = 'invoiced';
      } else if (d.a === 'reqreview') {
        j.review = { at: new Date().toISOString(), count: ((j.review && j.review.count) || 0) + 1 };
        send = sendReview_;
      } else return out_({ ok: false, err: 'Bad action' });
    }
    if (send) {
      try { send(j); } catch (x) { return out_({ ok: false, err: String(x.message || x) }); }
    }
    try {
      if (d.a === 'create' || d.a === 'qedit') qboQuietJob_('estimate', j);
      else if (d.a === 'invoice') qboQuietJob_('invoice', j);
    } catch (eQj) {}
    save_(js);
  } finally { L.releaseLock(); }
  return out_({ ok: true, testMode: TEST_MODE, job: j });
}
var REM_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
var REM_MON = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
var REM_DONE = { declined: 1, complete: 1, invoiced: 1 };
var REM_N = 0;
function callLog_() {
  var list = load_('reminders.json');
  return Array.isArray(list) ? list : [];
}
function saveCallLog_(list) {
  if (!Array.isArray(list)) list = [];
  if (list.length > 200) list = list.slice(0, 200);
  save_(list, 'reminders.json');
}
function logReminder_(row) {
  var list = callLog_();
  var err = String(row && row.error || '');
  var manual = !!(row && row.manual);
  var type = String(row && row.type || '').slice(0, 12);
  if (!manual && err === 'not configured' && list.length && list[0].error === 'not configured' && String(list[0].type || '') === type) {
    var prev = Date.parse(list[0].at || '');
    if (!isNaN(prev) && Date.now() - prev < 6 * 36e5) return list;
  }
  list.unshift({
    id: String((row && row.id) || ('RC' + Date.now().toString(36).toUpperCase() + (REM_N++))).slice(0, 48),
    at: new Date().toISOString(),
    jobId: String(row && row.jobId || '').slice(0, 40),
    customer: String(row && row.customer || '').slice(0, 120),
    to: String(row && row.to || '').slice(0, 20),
    test: !!(row && row.test),
    manual: manual,
    type: type,
    kind: String(row && row.kind || '').slice(0, 12),
    sid: String(row && row.sid || '').slice(0, 64),
    status: String(row && row.status || '').slice(0, 40),
    error: err.slice(0, 180),
    forStart: String(row && row.forStart || '').slice(0, 40),
    final: !!(row && (row.final || reminderFinal_(row.status))),
    questions: (row && Array.isArray(row.questions)) ? questionsFrom_(row.questions) : [],
    answers: [],
    no: false,
    callback: false
  });
  if (list.length > 200) list = list.slice(0, 200);
  saveCallLog_(list);
  return list;
}
function alreadyLogged_(list, jobId, forStart, error) {
  var i;
  for (i = 0; i < list.length; i++) {
    if (list[i].jobId === jobId && list[i].forStart === forStart && list[i].error === error) return true;
  }
  return false;
}
function twilioCreds_() {
  var sid = scriptProp_('TWILIO_SID');
  var token = scriptProp_('TWILIO_TOKEN');
  var from = e164_(scriptProp_('TWILIO_FROM'));
  if (!sid || !token || !from) return null;
  return { sid: sid, token: token, from: from };
}
function twilioAuth_(creds) {
  return 'Basic ' + Utilities.base64Encode(creds.sid + ':' + creds.token);
}
function twilioClip_(msg, creds) {
  var s = clipErr_(msg, creds && creds.token);
  s = clipErr_(s, creds && creds.sid);
  return s.slice(0, 180) || 'call failed';
}
function voiceSign_(msg, secret) {
  var raw = Utilities.computeHmacSha256Signature(String(msg), String(secret || ''));
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '');
}
function twilioCall_(creds, to, twiml) {
  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(creds.sid) + '/Calls.json';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    headers: { Authorization: twilioAuth_(creds) },
    payload: { To: to, From: creds.from, Twiml: twiml }
  });
  var code = res.getResponseCode();
  var body = res.getContentText() || '';
  var parsed = {};
  try { parsed = JSON.parse(body) || {}; } catch (e) { parsed = {}; }
  if (code < 200 || code >= 300 || !parsed.sid) return { ok: false, error: twilioClip_(parsed.message || body || ('HTTP ' + code), creds) };
  return { ok: true, sid: String(parsed.sid), status: String(parsed.status || 'queued') };
}
function placeReminder_(creds, to, intro, questions, jobId, logId) {
  var base = '';
  try { base = ScriptApp.getService().getUrl() || ''; } catch (eUrl) { base = ''; }
  return twilioCall_(creds, to, callTwiml_(intro, questions, jobId, logId, creds.token, base, voiceSign_));
}
function twilioSms_(creds, to, body) {
  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(creds.sid) + '/Messages.json';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    headers: { Authorization: twilioAuth_(creds) },
    payload: { To: to, From: creds.from, Body: String(body || '').slice(0, 480) }
  });
  var code = res.getResponseCode();
  var raw = res.getContentText() || '';
  var parsed = {};
  try { parsed = JSON.parse(raw) || {}; } catch (eSms) { parsed = {}; }
  if (code < 200 || code >= 300 || !parsed.sid) return { ok: false, error: twilioClip_(parsed.message || raw || ('HTTP ' + code), creds) };
  return { ok: true, sid: String(parsed.sid), status: String(parsed.status || 'queued') };
}
function twilioStatus_(creds, sid) {
  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(creds.sid) + '/Calls/' + encodeURIComponent(sid) + '.json';
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: twilioAuth_(creds) }
  });
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) return '';
  try { return String((JSON.parse(res.getContentText() || '{}') || {}).status || ''); }
  catch (e) { return ''; }
}
function etDate_(ymd, hm) {
  var p = String(hm || '08:00').split(':');
  var hh = ('0' + (parseInt(p[0], 10) || 0)).slice(-2);
  var mm = ('0' + (parseInt(p[1], 10) || 0)).slice(-2);
  var y = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return null;
  try { return Utilities.parseDate(y + ' ' + hh + ':' + mm + ':00', 'America/New_York', 'yyyy-MM-dd HH:mm:ss'); }
  catch (e) { return null; }
}
function addEtDays_(ymd, days) {
  var noon = etDate_(ymd, '12:00');
  if (!noon) return '';
  return Utilities.formatDate(new Date(noon.getTime() + days * 86400000), 'America/New_York', 'yyyy-MM-dd');
}
function etDow_(ymd) {
  var noon = etDate_(ymd, '12:00');
  if (!noon) return -1;
  var eee = Utilities.formatDate(noon, 'America/New_York', 'EEE').toLowerCase();
  var i;
  for (i = 0; i < REM_DAYS.length; i++) if (REM_DAYS[i].indexOf(eee) === 0) return i;
  return -1;
}
function whenClock_(text) {
  var t = String(text || '').toLowerCase();
  var m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  var h, min;
  if (m) {
    h = parseInt(m[1], 10);
    min = parseInt(m[2] || '0', 10) || 0;
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) return '08:00';
    return ('0' + h).slice(-2) + ':' + ('0' + min).slice(-2);
  }
  var at = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (at) {
    h = parseInt(at[1], 10);
    min = parseInt(at[2] || '0', 10) || 0;
    if (h < 7) h += 12;
    if (h > 23 || min > 59) return '08:00';
    return ('0' + h).slice(-2) + ':' + ('0' + min).slice(-2);
  }
  if (/\bafternoon\b/.test(t)) return '12:00';
  return '08:00';
}
function whenYmd_(text, todayYmd, nowMs) {
  var t = String(text || '').toLowerCase();
  var year = parseInt(String(todayYmd).slice(0, 4), 10);
  if (!year) return '';
  var md = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  var mo, da, y, ymd, i, mon, dn, hit, hits, dow, delta, clock, startToday;
  if (md) {
    mo = parseInt(md[1], 10);
    da = parseInt(md[2], 10);
    y = md[3] ? parseInt(md[3], 10) : year;
    if (y < 100) y += 2000;
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return '';
    ymd = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + da).slice(-2);
    if (!md[3] && ymd < todayYmd) ymd = (y + 1) + '-' + ('0' + mo).slice(-2) + '-' + ('0' + da).slice(-2);
    return ymd;
  }
  mon = -1;
  dn = 0;
  for (i = 0; i < REM_MON.length; i++) {
    hit = t.match(new RegExp('\\b' + REM_MON[i].slice(0, 3) + '[a-z]*\\.?\\s+(\\d{1,2})\\b'));
    if (hit) { mon = i + 1; dn = parseInt(hit[1], 10); break; }
  }
  if (mon > 0 && dn >= 1 && dn <= 31) {
    ymd = year + '-' + ('0' + mon).slice(-2) + '-' + ('0' + dn).slice(-2);
    if (ymd < todayYmd) ymd = (year + 1) + '-' + ('0' + mon).slice(-2) + '-' + ('0' + dn).slice(-2);
    return ymd;
  }
  if (/\btomorrow\b/.test(t)) return addEtDays_(todayYmd, 1);
  hits = [];
  for (i = 0; i < REM_DAYS.length; i++) if (new RegExp('\\b' + REM_DAYS[i] + '\\b').test(t)) hits.push(i);
  if (hits.length !== 1) return '';
  dow = etDow_(todayYmd);
  if (dow < 0) return '';
  delta = (hits[0] - dow + 7) % 7;
  clock = whenClock_(t);
  if (delta === 0) {
    startToday = etDate_(todayYmd, clock);
    if (!(startToday && startToday.getTime() > nowMs)) delta = 7;
  }
  if (!delta) return todayYmd;
  return addEtDays_(todayYmd, delta);
}
function jobLabel_(j) {
  var name = String(j && j.name || '').replace(/\s+/g, ' ').trim();
  var system = String(j && j.system || '').replace(/\s+/g, ' ').trim();
  var line = name && system ? name + ', ' + system : (name || system || 'your floor');
  return line.slice(0, 80);
}
function jobAppt_(job, blocks, now) {
  if (!job || REM_DONE[job.status]) return null;
  var nowMs = now.getTime();
  var best = null, bestMs = 0, i, b, start, ms, when, today, ymd;
  var list = Array.isArray(blocks) ? blocks : [];
  for (i = 0; i < list.length; i++) {
    b = list[i];
    if (!b || b.job !== job.id || !b.date || !b.start) continue;
    start = etDate_(String(b.date).slice(0, 10), String(b.start).slice(0, 5));
    if (!start) continue;
    ms = start.getTime();
    if (ms <= nowMs) continue;
    if (!best || ms < bestMs) { best = start; bestMs = ms; }
  }
  if (!best && job.status === 'approved') {
    when = String((job.response && job.response.when) || '').trim();
    today = Utilities.formatDate(now, 'America/New_York', 'yyyy-MM-dd');
    ymd = whenYmd_(when, today, nowMs);
    if (ymd) best = etDate_(ymd, whenClock_(when));
  }
  if (!best || best.getTime() <= nowMs) return null;
  return {
    start: best,
    key: Utilities.formatDate(best, 'America/New_York', "yyyy-MM-dd'T'HH:mm"),
    dateLabel: Utilities.formatDate(best, 'America/New_York', 'EEEE, MMMM d'),
    timeLabel: Utilities.formatDate(best, 'America/New_York', 'h:mm a')
  };
}
function pollReminders_(creds, jobs, log) {
  var changed = false, now = Date.now(), i, row, at, status, j;
  for (i = 0; i < log.length; i++) {
    row = log[i];
    if (!row || !row.sid || row.final || row.type === 'sms') continue;
    at = Date.parse(row.at || '');
    if (isNaN(at) || now - at > 36 * 36e5) continue;
    status = twilioStatus_(creds, row.sid);
    if (!status || status === row.status) continue;
    row.status = status;
    if (reminderFinal_(status)) row.final = true;
    changed = true;
    for (j = 0; j < jobs.length; j++) {
      if (jobs[j].reminded && jobs[j].reminded.sid === row.sid) jobs[j].reminded.status = status;
    }
  }
  return changed;
}
function runRemindersLocked_() {
  var cfg = reminderCfg_(loadObj_('settings.json'));
  if (!cfg.on) return { ok: true, skipped: 'off' };
  var creds = twilioCreds_();
  var jobs = load_();
  var blocks = load_('blocks.json');
  if (!Array.isArray(jobs)) jobs = [];
  if (!Array.isArray(blocks)) blocks = [];
  var log = callLog_();
  var jobsChanged = false;
  if (creds && pollReminders_(creds, jobs, log)) {
    saveCallLog_(log);
    jobsChanged = true;
  }
  if (!creds) {
    logReminder_({ jobId: '', customer: '', to: '', test: cfg.test !== false, error: 'not configured', status: '' });
    if (jobsChanged) save_(jobs);
    return { ok: true, called: false, error: 'not configured' };
  }
  var now = new Date(), i, j, appt, choice, say, made;
  for (i = 0; i < jobs.length; i++) {
    j = jobs[i];
    appt = jobAppt_(j, blocks, now);
    if (!appt || !reminderDue_(appt.start.getTime(), now.getTime())) continue;
    if (j.reminded && j.reminded.forStart === appt.key) continue;
    choice = reminderDial_(cfg, j.phone);
    if (!guardDial_(choice, cfg.testPhone, j.phone)) {
      if (choice && (choice.skip === 'no phone' || choice.skip === 'no test number') && !alreadyLogged_(log, j.id, appt.key, choice.skip)) {
        log = logReminder_({ jobId: j.id, customer: j.name || '', to: '', test: cfg.test !== false, error: choice.skip, forStart: appt.key, status: 'skipped' });
      }
      continue;
    }
    say = reminderSay_(jobLabel_(j), appt.dateLabel, appt.timeLabel, j.address || '');
    var logId = 'RC' + Date.now().toString(36).toUpperCase() + (REM_N++);
    try { made = placeReminder_(creds, choice.dial, say, cfg.questions, j.id, logId); }
    catch (eCall) { made = { ok: false, error: String(eCall.message || eCall).slice(0, 180) }; }
    log = logReminder_({
      id: logId, jobId: j.id, customer: j.name || '', to: choice.dial, test: !!choice.test,
      sid: made.sid || '', status: made.status || '', error: made.error || '',
      forStart: appt.key, final: reminderFinal_(made.status), questions: cfg.questions
    });
    if (made.ok && made.sid) {
      j.reminded = { at: new Date().toISOString(), forStart: appt.key, sid: made.sid, status: made.status || 'queued', to: choice.dial, test: !!choice.test };
      jobsChanged = true;
    }
  }
  if (jobsChanged) save_(jobs);
  return { ok: true };
}
function remindDue_() {
  var L = LockService.getScriptLock();
  try { L.waitLock(25000); } catch (eLock) { return; }
  try { runRemindersLocked_(); }
  catch (e) {
    try { logReminder_({ jobId: '', customer: '', to: '', test: false, error: String(e && e.message || e).slice(0, 180), status: 'error' }); } catch (e2) {}
  }
  try { runTextsLocked_(); }
  catch (eText) {
    try { logReminder_({ jobId: '', customer: '', to: '', test: false, type: 'sms', error: String(eText && eText.message || eText).slice(0, 180), status: 'error' }); } catch (e4) {}
  } finally { try { L.releaseLock(); } catch (e3) {} }
}
function smsMarked_(j, kind, key) {
  var bag = j && j.smsReminded;
  return !!(bag && bag[kind] && bag[kind].forStart === key);
}
function runTextsLocked_() {
  var cfg = smsCfg_(loadObj_('settings.json'));
  if (!cfg.on) return { ok: true, skipped: 'off' };
  var creds = twilioCreds_();
  var jobs = load_();
  var blocks = load_('blocks.json');
  if (!Array.isArray(jobs)) jobs = [];
  if (!Array.isArray(blocks)) blocks = [];
  if (!creds) {
    logReminder_({ jobId: '', customer: '', to: '', test: cfg.test !== false, error: 'not configured', status: '', type: 'sms' });
    return { ok: true, called: false, error: 'not configured' };
  }
  var now = new Date();
  var log = callLog_();
  var jobsChanged = false;
  var i, j, appt, ymd, seven, k, kind, due, choice, body, made, logId;
  for (i = 0; i < jobs.length; i++) {
    j = jobs[i];
    appt = jobAppt_(j, blocks, now);
    if (!appt) continue;
    ymd = Utilities.formatDate(appt.start, 'America/New_York', 'yyyy-MM-dd');
    seven = etDate_(ymd, '07:00');
    for (k = 0; k < 2; k++) {
      kind = k === 0 ? '24h' : 'dayof';
      due = kind === '24h' ? reminderDue_(appt.start.getTime(), now.getTime()) : smsDayDue_(appt.start.getTime(), seven ? seven.getTime() : (appt.start.getTime() - 2 * 36e5), now.getTime());
      if (!due || smsMarked_(j, kind, appt.key)) continue;
      choice = smsDial_(cfg, j.phone);
      if (!guardDial_(choice, cfg.testPhone, j.phone)) {
        if (choice && (choice.skip === 'no phone' || choice.skip === 'no test number') && !alreadyLogged_(log, j.id, appt.key + '|' + kind, choice.skip)) {
          log = logReminder_({ jobId: j.id, customer: j.name || '', to: '', test: cfg.test !== false, error: choice.skip, forStart: appt.key + '|' + kind, status: 'skipped', type: 'sms', kind: kind });
        }
        continue;
      }
      body = smsFill_(kind === '24h' ? cfg.t24 : cfg.dayof, { name: j.name, address: j.address, date: appt.dateLabel, time: appt.timeLabel, est: smsEst_(j.est), work: smsWork_(j.system, j.sqft) });
      logId = 'RC' + Date.now().toString(36).toUpperCase() + (REM_N++);
      try { made = twilioSms_(creds, choice.dial, body); }
      catch (eSend) { made = { ok: false, error: String(eSend.message || eSend).slice(0, 180) }; }
      log = logReminder_({
        id: logId, jobId: j.id, customer: j.name || '', to: choice.dial, test: !!choice.test,
        sid: made.sid || '', status: made.status || '', error: made.error || '',
        forStart: appt.key, type: 'sms', kind: kind, final: true
      });
      if (made.ok && made.sid) {
        if (!j.smsReminded || typeof j.smsReminded !== 'object') j.smsReminded = {};
        j.smsReminded[kind] = { at: new Date().toISOString(), forStart: appt.key, sid: made.sid, status: made.status || 'queued', to: choice.dial, test: !!choice.test };
        jobsChanged = true;
      }
    }
  }
  if (jobsChanged) save_(jobs);
  return { ok: true };
}
function remindTest_(testPhoneRaw) {
  var phone = e164_(testPhoneRaw) || e164_(reminderCfg_(loadObj_('settings.json')).testPhone);
  var now = new Date();
  var today = Utilities.formatDate(now, 'America/New_York', 'yyyy-MM-dd');
  var start = etDate_(addEtDays_(today, 1), '08:00');
  var say = reminderSay_('Sample floor', Utilities.formatDate(start, 'America/New_York', 'EEEE, MMMM d'), Utilities.formatDate(start, 'America/New_York', 'h:mm a'), '1200 Call Street, Tallahassee, FL');
  var creds, made, log;
  if (!phone) {
    log = logReminder_({ jobId: 'sample', customer: 'Sample floor', to: '', test: true, error: 'no test number', status: 'skipped' });
    return { ok: true, called: false, error: 'no test number', callLog: log.slice(0, 80) };
  }
  creds = twilioCreds_();
  if (!creds) {
    log = logReminder_({ jobId: 'sample', customer: 'Sample floor', to: phone, test: true, error: 'not configured', status: '' });
    return { ok: true, called: false, error: 'not configured', callLog: log.slice(0, 80) };
  }
  var logId = 'RC' + Date.now().toString(36).toUpperCase() + (REM_N++);
  var qs = reminderCfg_(loadObj_('settings.json')).questions;
  try { made = placeReminder_(creds, phone, say, qs, 'sample', logId); }
  catch (e) { made = { ok: false, error: String(e.message || e).slice(0, 180) }; }
  log = logReminder_({
    id: logId, jobId: 'sample', customer: 'Sample floor', to: phone, test: true,
    sid: made.sid || '', status: made.status || '', error: made.error || '',
    forStart: Utilities.formatDate(start, 'America/New_York', "yyyy-MM-dd'T'HH:mm"),
    final: reminderFinal_(made.status), questions: qs
  });
  return { ok: true, called: !!made.ok, sid: made.sid || '', status: made.status || '', error: made.error || '', callLog: log.slice(0, 80) };
}
function upcomingJob_(jobs, blocks, now) {
  var best = null, bestJob = null, i, appt;
  var list = Array.isArray(jobs) ? jobs : [];
  for (i = 0; i < list.length; i++) {
    appt = jobAppt_(list[i], blocks, now);
    if (!appt) continue;
    if (!best || appt.start.getTime() < best.start.getTime()) {
      best = appt;
      bestJob = list[i];
    }
  }
  return bestJob ? { job: bestJob, appt: best } : null;
}
function remindNow_(ids) {
  var raw = Array.isArray(ids) ? ids : [];
  var jobs = load_();
  if (!Array.isArray(jobs)) jobs = [];
  var mine = [], seen = {}, i, k, id;
  for (i = 0; i < raw.length && mine.length < 40; i++) {
    id = String(raw[i] || '');
    if (!id || seen[id]) continue;
    for (k = 0; k < jobs.length; k++) {
      if (jobs[k] && jobs[k].id === id) { mine.push(jobs[k]); seen[id] = 1; break; }
    }
  }
  var name = mine.length && mine[0].name ? String(mine[0].name) : '';
  var phone = '';
  var fallbackId = mine.length ? String(mine[0].id || '') : '';
  for (i = 0; i < mine.length; i++) if (!phone) phone = e164_(mine[i].phone);
  var blocks = load_('blocks.json');
  if (!Array.isArray(blocks)) blocks = [];
  var hit = upcomingJob_(mine, blocks, new Date());
  var jobId = hit ? String(hit.job.id || '') : fallbackId;
  var say = hit ? reminderSay_(jobLabel_(hit.job), hit.appt.dateLabel, hit.appt.timeLabel, hit.job.address || '') : manualSay_();
  var forStart = hit ? hit.appt.key : '';
  var customer = (hit && hit.job.name) ? String(hit.job.name) : name;
  var log, creds, made;
  if (!phone) {
    log = logReminder_({ jobId: jobId, customer: customer, to: '', test: false, manual: true, error: 'no phone', status: 'skipped' });
    return { ok: true, called: false, error: 'no phone', callLog: log.slice(0, 80) };
  }
  creds = twilioCreds_();
  if (!creds) {
    log = logReminder_({ jobId: jobId, customer: customer, to: phone, test: false, manual: true, error: 'not configured', status: '' });
    return { ok: true, called: false, error: 'not configured', callLog: log.slice(0, 80) };
  }
  var logId = 'RC' + Date.now().toString(36).toUpperCase() + (REM_N++);
  var qs = questionsFrom_(((loadObj_('settings.json') || {}).reminders || {}).questions);
  try { made = placeReminder_(creds, phone, say, qs, jobId, logId); }
  catch (eNow) { made = { ok: false, error: String(eNow.message || eNow).slice(0, 180) }; }
  log = logReminder_({
    id: logId, jobId: jobId, customer: customer, to: phone, test: false, manual: true,
    sid: made.sid || '', status: made.status || '', error: made.error || '',
    forStart: forStart, final: reminderFinal_(made.status), questions: qs
  });
  return { ok: true, called: !!made.ok, sid: made.sid || '', status: made.status || '', error: made.error || '', callLog: log.slice(0, 80) };
}
function textNow_(ids) {
  var raw = Array.isArray(ids) ? ids : [];
  var jobs = load_();
  if (!Array.isArray(jobs)) jobs = [];
  var mine = [], seen = {}, i, k, id;
  for (i = 0; i < raw.length && mine.length < 40; i++) {
    id = String(raw[i] || '');
    if (!id || seen[id]) continue;
    for (k = 0; k < jobs.length; k++) {
      if (jobs[k] && jobs[k].id === id) { mine.push(jobs[k]); seen[id] = 1; break; }
    }
  }
  var name = mine.length && mine[0].name ? String(mine[0].name) : '';
  var phone = '';
  var fallbackId = mine.length ? String(mine[0].id || '') : '';
  var address = mine.length ? String(mine[0].address || '') : '';
  for (i = 0; i < mine.length; i++) if (!phone) phone = e164_(mine[i].phone);
  var blocks = load_('blocks.json');
  if (!Array.isArray(blocks)) blocks = [];
  var hit = upcomingJob_(mine, blocks, new Date());
  var jobId = hit ? String(hit.job.id || '') : fallbackId;
  var customer = (hit && hit.job.name) ? String(hit.job.name) : name;
  var cfg = smsCfg_(loadObj_('settings.json'));
  var choice, log, creds, made, body;
  if (cfg.test !== false) {
    choice = { dial: e164_(cfg.testPhone), test: true };
    if (!choice.dial) {
      log = logReminder_({ jobId: jobId, customer: customer, to: '', test: true, manual: true, type: 'sms', kind: 'now', error: 'no test number', status: 'skipped' });
      return { ok: true, called: false, error: 'no test number', callLog: log.slice(0, 80) };
    }
  } else if (!cfg.on) {
    return { ok: true, called: false, error: 'off', callLog: callLog_().slice(0, 80) };
  } else {
    choice = { dial: phone, test: false };
    if (!choice.dial) {
      log = logReminder_({ jobId: jobId, customer: customer, to: '', test: false, manual: true, type: 'sms', kind: 'now', error: 'no phone', status: 'skipped' });
      return { ok: true, called: false, error: 'no phone', callLog: log.slice(0, 80) };
    }
  }
  if (!guardDial_(choice, cfg.testPhone, phone)) {
    return { ok: true, called: false, error: 'off', callLog: callLog_().slice(0, 80) };
  }
  var srcJob = hit ? hit.job : (mine.length ? mine[0] : {});
  var fields = {
    name: (srcJob && srcJob.name) || customer,
    address: (srcJob && srcJob.address) || address,
    date: hit ? hit.appt.dateLabel : '',
    time: hit ? hit.appt.timeLabel : '',
    est: smsEst_(srcJob && srcJob.est),
    work: smsWork_(srcJob && srcJob.system, srcJob && srcJob.sqft)
  };
  if (hit) body = smsFill_(cfg.t24, fields);
  else body = smsFill_('Hi {name}, this is Southern Concrete Coatings with a reminder about estimate {est} ({work}).', fields);
  creds = twilioCreds_();
  if (!creds) {
    log = logReminder_({ jobId: jobId, customer: customer, to: choice.dial, test: !!choice.test, manual: true, type: 'sms', kind: 'now', error: 'not configured', status: '' });
    return { ok: true, called: false, error: 'not configured', callLog: log.slice(0, 80) };
  }
  try { made = twilioSms_(creds, choice.dial, body); }
  catch (eText) { made = { ok: false, error: String(eText.message || eText).slice(0, 180) }; }
  log = logReminder_({
    jobId: jobId, customer: customer, to: choice.dial, test: !!choice.test, manual: true, type: 'sms', kind: 'now',
    sid: made.sid || '', status: made.status || '', error: made.error || '', final: true
  });
  return { ok: true, called: !!made.ok, sid: made.sid || '', status: made.status || '', error: made.error || '', callLog: log.slice(0, 80) };
}
function saveVoiceAnswer_(jobId, logId, row) {
  var item = {
    q: String(row && row.q || '').slice(0, 240),
    type: row && row.type === 'speech' ? 'speech' : 'yesno',
    answer: String(row && row.answer || '').slice(0, 500),
    callback: !!(row && row.callback),
    at: new Date().toISOString()
  };
  var jobs = load_();
  var i, changed = false;
  if (jobId && jobId !== 'sample' && Array.isArray(jobs)) {
    for (i = 0; i < jobs.length; i++) {
      if (!jobs[i] || jobs[i].id !== jobId) continue;
      if (!Array.isArray(jobs[i].callAnswers)) jobs[i].callAnswers = [];
      jobs[i].callAnswers.push(item);
      if (jobs[i].callAnswers.length > 40) jobs[i].callAnswers = jobs[i].callAnswers.slice(-40);
      changed = true;
      break;
    }
    if (changed) save_(jobs);
  }
  var log = callLog_();
  for (i = 0; i < log.length; i++) {
    if (!log[i] || log[i].id !== logId) continue;
    if (!Array.isArray(log[i].answers)) log[i].answers = [];
    log[i].answers.push(item);
    if (log[i].answers.length > 20) log[i].answers = log[i].answers.slice(-20);
    if (item.answer === 'no') log[i].no = true;
    if (item.callback) log[i].callback = true;
    break;
  }
  saveCallLog_(log);
}
function twimlOut_(xml) {
  return ContentService.createTextOutput(xml).setMimeType(ContentService.MimeType.XML);
}
function twvoice_(p) {
  var jobId = String(p && p.job || '').slice(0, 40);
  var logId = String(p && p.log || '').slice(0, 48);
  var cfg = reminderCfg_(loadObj_('settings.json'));
  var questions = cfg.questions;
  var log = callLog_();
  var i;
  for (i = 0; i < log.length; i++) {
    if (log[i] && log[i].id === logId && Array.isArray(log[i].questions) && log[i].questions.length) {
      questions = log[i].questions;
      break;
    }
  }
  var base = '';
  try { base = ScriptApp.getService().getUrl() || ''; } catch (eUrl) { base = ''; }
  var step = voiceStep_({
    jobId: jobId, logId: logId, q: p && p.q, tok: p && p.tok,
    digits: (p && (p.Digits || p.digits)) || '',
    speech: (p && (p.SpeechResult || p.speech)) || '',
    questions: questions, secret: scriptProp_('TWILIO_TOKEN'), base: base, sign: voiceSign_
  });
  if (step.save) {
    var L = LockService.getScriptLock();
    try { L.waitLock(20000); saveVoiceAnswer_(jobId, logId, step.save); }
    catch (eSave) {}
    finally { try { L.releaseLock(); } catch (eRel) {} }
  }
  return twimlOut_(step.twiml);
}
function installReminderTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'remindDue_') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('remindDue_').timeBased().everyHours(1).create();
}
function setup() {
  Logger.log(root_().getUrl());
  installReminderTrigger();
}
