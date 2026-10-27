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
