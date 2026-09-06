(function(){
  const c=window.SUPABASE_CONFIG;
  if(!c || !window.supabase) return;
  window.sb=window.supabase.createClient(c.url,c.publishableKey);
  window.supabaseReady=true;

  window.pullDeliveries=async function(){
    const {data,error}=await sb.from("deliveries").select("*").order("route_order",{ascending:true,nullsFirst:false}).order("created_at",{ascending:true});
    if(error) throw error;
    return (data||[]).map(x=>({id:x.id,address:x.address,number:x.number,district:x.district,lat:x.lat,lon:x.lon,done:x.done,route_order:x.route_order}));
  };
  window.pushDeliveries=async function(items){
    const rows=items.map((d,i)=>({id:d.id||undefined,address:d.address,number:d.number,district:d.district,lat:d.lat??null,lon:d.lon??null,route_order:d.route_order??i,done:d.done??false}));
    const {data,error}=await sb.from("deliveries").upsert(rows,{onConflict:"id"}).select("*");
    if(error) throw error;
    return data||[];
  };
  window.clearCloudDeliveries=async function(){
    const {error}=await sb.from("deliveries").delete().not("id","is",null);
    if(error) throw error;
  };
})();