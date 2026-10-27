// Southern Concrete Coatings Field Desk — Google Apps Script backend.
// Paste this whole file into script.google.com, then Deploy > New deployment > Web app.
// Execute as: Me. Who has access: Anyone.
// Run setup() once from the editor and approve Drive and Gmail.
//
// TEST_MODE below is the server copy of the single flag in config.js.
// While it is true, every MailApp send is forced to TEST_TO. There is no other send path.
// No API keys or passwords belong in this file. Gmail and Drive use the Google account you deploy with.

/* Quote rewriter, per-sq-ft math, and email copy.
   Shared by the field desk (browser) and Code.gs (Apps Script).
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
function specRows(j){
  var rows=[
    ['Square footage',j.sqft?formatSq(j.sqft)+' sq ft':''],
    ['Coating system',j.system||''],
    ['Color / flake',j.color||''],
    ['Prep',j.prep||''],
    ['Return to service',j.cure||''],
    ['Price per sq ft',j.rate?money(j.rate)+' / sq ft':'']
  ].filter(function(r){return r[1];});
  if(!rows.length)return '';
  return '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:0 0 16px">'+
    rows.map(function(r){
      return '<tr><td style="padding:6px 8px;border-bottom:1px solid #e6e8ee;color:#5c6370;width:42%">'+escHtml(r[0])+'</td><td style="padding:6px 8px;border-bottom:1px solid #e6e8ee"><b>'+escHtml(r[1])+'</b></td></tr>';
    }).join('')+'</table>';
}
function itemsTable(j,colors){
  var dg=colors.dg;
  var rows=(j.items||[]).map(function(i,n){
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
  return '<table width="100%" style="font-size:14px;margin:0 0 16px"><tr><td style="vertical-align:top"><b style="color:'+colors.n+'">Prepared for</b><br>'+
    escHtml(j.name)+'<br>'+escHtml(j.address)+'<br>'+escHtml(j.email)+'</td><td style="vertical-align:top;text-align:right"><b style="color:'+colors.n+'">'+
    escHtml(label)+'</b> '+escHtml(no)+'<br>Date: '+escHtml(j.date||'')+'</td></tr></table>';
}
var TERMS=[
  'This estimate is valid for 30 days from the date above.',
  'The price is based on the square footage, coating system, and prep described here. If grinding uncovers extra cracks, spalls, or moisture, we stop and price that work before going on.',
  'Please have vehicles and stored items off the floor before the crew arrives.',
  'Return-to-service time depends on the system and the temperature. The cure time on this estimate is the plan; we will confirm it on site.',
  'One-day installations are available on many garage floors. Heavier metallic and commercial systems can take longer.',
  'Payment is due when the floor is complete, unless the invoice says otherwise.'
];
function quoteEmailHtml(o){
  var j=o.job,g=o.colors.g,dg=o.colors.dg,n=o.colors.n;
  function btn(k,t,c){
    return '<a href="'+o.link(k)+'" style="display:block;margin:8px 0;padding:15px;background:'+c+';color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;text-align:center">'+t+'</a>';
  }
  var inner='<p style="font-size:16px">Dear '+escHtml(j.name)+',</p>'+
    '<p style="line-height:1.6">Thank you for asking Southern Concrete Coatings to look at the concrete at your property. Below is the estimate for the coating system we discussed. A PDF copy is attached.</p>'+
    metaBlock(j,'Estimate #',j.est,o.colors)+specRows(j)+itemsTable(j,o.colors)+
    (o.photosHtml?'<p style="margin:18px 0 6px"><b style="color:'+n+'">Site photos</b></p>'+o.photosHtml:'')+
    '<div style="background:#f4f5f8;border-radius:10px;padding:16px;margin:20px 0"><p style="margin:0 0 4px;font-size:16px"><b style="color:'+n+'">Ready to coat the floor? Tap one:</b></p>'+
    '<p style="margin:0 0 6px;color:#5c6370;font-size:13px">Next we will ask when the crew can have the floor.</p>'+
    btn('A','A) Approve — schedule my floor',g)+
    btn('B','B) Approve with changes',dg)+
    btn('C','C) Decline for now','#8a8f98')+
    btn('O','Other — send a question',n)+'</div>'+
    '<p style="font-size:13px;color:#5c6370;line-height:1.6"><b>Terms:</b> '+TERMS.join(' ')+'</p>'+
    '<p>Sincerely,<br><b>'+escHtml(o.co.name)+'</b></p>';
  return emailShell(Object.assign({},o,{title:'Estimate',sub:j.est}),inner);
}
function pdfHtml(o){
  var j=o.job;
  var inner=metaBlock(j,'Estimate #',j.est,o.colors)+specRows(j)+itemsTable(j,o.colors)+
    '<h3 style="color:'+o.colors.n+';margin:22px 0 6px;font-size:15px">Terms</h3><ul style="font-size:13px;color:#33383d;line-height:1.6;padding-left:18px">'+
    TERMS.map(function(t){return '<li>'+escHtml(t)+'</li>';}).join('')+'</ul>'+
    '<p style="font-size:13px">To approve, use the buttons in the estimate email or call '+escHtml(o.co.phone)+'.</p>'+
    '<table width="100%" style="margin-top:28px;font-size:13px"><tr><td>Customer signature: ____________________________</td><td style="text-align:right">Date: ______________</td></tr></table>';
  return '<html><head><style>@page{margin:28px}body{font-family:Arial,Helvetica,sans-serif}</style></head><body>'+
    emailShell(Object.assign({},o,{title:'Estimate',sub:j.est,testMode:false}),inner)+'</body></html>';
}
function recapEmailHtml(o){
  var j=o.job,n=o.colors.n,dg=o.colors.dg,g=o.colors.g;
  var av=[j.response&&j.response.avail,j.response&&j.response.when].filter(Boolean).join(' - ');
  var referHref='mailto:?subject='+encodeURIComponent('Floor coating I recommend: Southern Concrete Coatings')+
    '&body='+encodeURIComponent('I used Southern Concrete Coatings in Tallahassee and was happy with the floor. Free estimates: '+o.co.site+' or '+o.co.phone);
  var refer='<a href="'+referHref+'" style="display:block;padding:15px;background:'+g+';color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;text-align:center;font-size:16px">Refer a neighbor</a>';
  var inner='<p style="font-size:16px">Hi '+escHtml(j.name)+',</p>'+
    '<p style="line-height:1.6">Your coating at '+escHtml(j.address)+' is complete. Here is a look at the floor, before and after.</p>'+
    specRows(j)+itemsTable(j,o.colors)+
    (av?'<p><b style="color:'+n+'">Scheduled from your preference:</b> '+escHtml(av)+'</p>':'')+
    (j.crewNotes?'<p><b style="color:'+n+'">Crew notes:</b> '+escHtml(j.crewNotes)+'</p>':'')+
    '<h3 style="color:'+dg+'">Before</h3>'+(o.beforeHtml||'<p style="color:#8a8f98">No photos</p>')+
    '<h3 style="color:'+dg+'">After</h3>'+(o.afterHtml||'<p style="color:#8a8f98">No photos</p>')+
    '<p style="line-height:1.6">Thank you for choosing Southern Concrete Coatings. If the floor turned out the way you wanted, we would be grateful if you passed our name to a neighbor.</p>'+refer;
  return emailShell(Object.assign({},o,{title:'Your floor is done',sub:j.est||''}),inner);
}
function invoiceEmailHtml(o){
  var j=o.job,v=j.invoice||{},inv=String(j.est||j.id).replace('EST','INV');
  var inner='<p style="font-size:16px">Dear '+escHtml(j.name)+',</p>'+
    '<p>Thank you for your business. Here is the invoice for the completed coating.</p>'+
    metaBlock(j,'Invoice #',inv,o.colors)+specRows(j)+itemsTable(j,o.colors)+
    '<p style="font-size:18px;text-align:right"><b>Amount due: <span style="color:'+o.colors.dg+'">'+escHtml(v.amount)+'</span></b></p>'+
    (v.note?'<p>'+escHtml(v.note)+'</p>':'')+
    '<p>Questions? Call '+escHtml(o.co.phone)+'.</p>';
  return emailShell(Object.assign({},o,{title:'Invoice',sub:inv}),inner);
}
function responseFormHtml(o){
  var j=o.job,ans=o.ans,labels=o.labels,slots=o.slots,action=o.action;
  var slotHtml=slots.map(function(s,i){
    return '<label style="display:block;width:100%;margin:8px 0;padding:18px;font-size:19px;font-weight:bold;border:3px solid '+o.colors.n+';background:#fff;color:'+o.colors.n+';border-radius:12px;text-align:center;box-sizing:border-box"><input type="radio" name="avail" value="'+escHtml(s)+'"'+(i===slots.length-1?' checked':'')+' style="margin-right:8px">'+escHtml(s)+'</label>';
  }).join('');
  var ask=(ans==='B'||ans==='O')?'<p><b>'+(ans==='B'?'What would you like changed?':'Your question or message:')+'</b></p><textarea name="text" rows="4" style="width:100%;box-sizing:border-box;font-size:17px;padding:14px;border:2px solid #cfd3de;border-radius:10px"></textarea>':'';
  return '<h2 style="color:'+o.colors.n+'">'+escHtml(labels[ans]||ans)+'</h2><p>Estimate '+escHtml(j.est||j.id)+' &middot; '+escHtml(j.address)+'</p>'+
    '<form method="get" action="'+escHtml(action)+'">'+
    '<input type="hidden" name="a" value="respond"><input type="hidden" name="id" value="'+escHtml(j.id)+'">'+
    '<input type="hidden" name="ans" value="'+escHtml(ans)+'"><input type="hidden" name="done" value="1">'+ask+
    '<p><b>When can the crew have the floor?</b> Tap one. The floor needs to be clear at the start of that window.</p>'+slotHtml+
    '<p><b>Preferred date or time (optional)</b></p><input type="text" name="when" placeholder="e.g. Tuesday morning" style="width:100%;box-sizing:border-box;font-size:17px;padding:14px;border:2px solid #cfd3de;border-radius:10px">'+
    '<button style="width:100%;padding:20px;font-size:21px;font-weight:bold;background:'+o.colors.g+';color:#fff;border:0;border-radius:12px;margin-top:14px">Send my answer</button></form>';
}

var SCCQuote={
  round2:round2,money:money,validEmail:validEmail,formatSq:formatSq,
  deliveryAddress:deliveryAddress,rewriteQuote:rewriteQuote,buildItems:buildItems,totalOf:totalOf,
  parseSqft:parseSqft,parseRate:parseRate,parseLump:parseLump,
  quoteEmailHtml:quoteEmailHtml,pdfHtml:pdfHtml,recapEmailHtml:recapEmailHtml,invoiceEmailHtml:invoiceEmailHtml,
  responseFormHtml:responseFormHtml,TERMS:TERMS,escHtml:escHtml
};
if(typeof module!=='undefined'&&module.exports)module.exports=SCCQuote;

var TEST_MODE = false; // single server flag — keep identical to config.js TEST_MODE
var TEST_TO = 'austin@techsourcedsolutions.com';
var ROOT_NAME = 'Southern Concrete Coatings Field Desk';
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
  var payload = {
    to: env.to,
    replyTo: env.replyTo,
    name: CO.name,
    subject: (TEST_MODE ? 'TEST - ' : '') + msg.subject,
    htmlBody: msg.html
  };
  if (msg.inlineImages) payload.inlineImages = msg.inlineImages;
  if (msg.attachments) payload.attachments = msg.attachments;
  MailApp.sendEmail(payload);
}
function mailOpts_(j) {
  return { co: CO, colors: COLORS, job: view_(j), testMode: TEST_MODE, testTo: TEST_TO, logoSrc: 'cid:logo' };
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
  if (!TEST_MODE && !validEmail(j.email)) throw new Error('Enter a valid customer email before sending.');
}
function sendQuote_(j) {
  customerOk_(j);
  var im = imgs_(j.photos, 'q');
  im.inl.logo = logoBlob_();
  var pdf = null;
  if (j.pdfId) { try { pdf = DriveApp.getFileById(j.pdfId).getBlob().setName('Southern Concrete Coatings Estimate ' + j.est + '.pdf'); } catch (e) { pdf = null; } }
  if (!pdf) pdf = makePdf_(j);
  sendMail_({
    job: j,
    subject: 'Your concrete coating estimate from Southern Concrete Coatings - ' + j.est,
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
function doGet(e) {
  var p = (e && e.parameter) || {};
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
    var av = [j.response.avail, j.response.when].filter(Boolean).join(' - ');
    return page_('<h2 style="color:' + COLORS.dg + '">Thank you</h2><p style="font-size:17px">Your answer was received: <b>' + escHtml(j.response.label) + '</b></p>' +
      (av ? '<p>Preferred time: <b>' + escHtml(av) + '</b></p>' : '') +
      (j.response.text ? '<p>Your note: ' + escHtml(j.response.text) + '</p>' : '') +
      '<p>We will confirm the installation window. Questions? Call ' + CO.phone + '.</p>');
  }
  return out_({ ok: true, testMode: TEST_MODE, testTo: TEST_MODE ? TEST_TO : '', root: root_().getUrl(), jobs: load_(), blocks: load_('blocks.json') });
}
function numField_(v) {
  if (v == null || v === '') return '';
  var n = Number(String(v).replace(/[$,]/g, ''));
  return isNaN(n) ? '' : n;
}
function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  var L = LockService.getScriptLock();
  L.waitLock(30000);
  var j, send = null, js;
  try {
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
    if (d.a === 'create') {
      if (d.email && !validEmail(d.email)) return out_({ ok: false, err: 'That customer email does not look valid.' });
      if (!TEST_MODE && !validEmail(d.email)) return out_({ ok: false, err: 'Enter a valid customer email before sending.' });
      var fields = { sqft: d.sqft, system: d.system, color: d.color, prep: d.prep, cure: d.cure, rate: d.rate };
      var items = (d.items && d.items.length) ? d.items : buildItems(fields, d.quote);
      j = {
        id: 'SCC-' + Date.now().toString(36).toUpperCase(),
        est: estNo_(),
        name: d.name,
        address: d.address,
        email: String(d.email || '').trim(),
        quote: d.quote || '',
        sqft: numField_(d.sqft),
        system: d.system || '',
        color: d.color || '',
        prep: d.prep || '',
        cure: d.cure || '',
        rate: numField_(d.rate),
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
      else if (d.a === 'resend') {
        if (!j.est) return out_({ ok: false, err: 'This job has no quote to resend' });
        send = sendQuote_;
        j.resent = (j.resent || 0) + 1;
        j.resentAt = new Date().toISOString();
      } else return out_({ ok: false, err: 'Bad action' });
    }
    if (send) {
      try { send(j); } catch (x) { return out_({ ok: false, err: String(x.message || x) }); }
    }
    save_(js);
  } finally { L.releaseLock(); }
  return out_({ ok: true, testMode: TEST_MODE, job: j });
}
function setup() { Logger.log(root_().getUrl()); }
