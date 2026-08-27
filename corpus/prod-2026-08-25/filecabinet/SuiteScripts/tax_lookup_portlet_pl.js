/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @NModuleScope SameAccount
 *
 * Tax Rate Lookup v2 — Inline HTML portlet
 *
 * Changes from v1:
 *   - All 50 states + DC (routing to engine vs. rate tables happens server-side;
 *     estimators never need to know where we hold a registration)
 *   - Optional County field for the no-address / new-construction workflow
 *   - Plain-language notes under the results (source, what's included, guidance)
 *
 * Suitelet: customscript_tax_lookup_sl_v2 / customdeploy_tax_lookup_sl_v2
 */
define(['N/url', 'N/log'], (url, log) => {

    const render = (params) => {
        try {
            const portlet = params.portlet;
            portlet.title = 'Tax Rate Lookup';

            const suiteletUrl = url.resolveScript({
                scriptId:     'customscript_tax_lookup_portlet_sl',
                deploymentId: 'customdeploy_tax_lookup_portlet_sl'
            });

            // All US states + DC — no nexus knowledge required from the user
            const SHIP_STATES = [
                ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],
                ['CA','California'],['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],
                ['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],
                ['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
                ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],
                ['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],
                ['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],
                ['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],
                ['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
                ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],
                ['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],
                ['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],
                ['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
            ];

            const stateOptions = SHIP_STATES
                .map(([code, name]) =>
                    `<option value="${code}"${code === 'AZ' ? ' selected' : ''}>${code} — ${name}</option>`
                )
                .join('');

            // Defined once, interpolated into onkeydown and onclick.
            // Single quotes only — the attribute wrapper uses double quotes.
            const fetchAndRender = `
                var city=document.getElementById('tax_city').value.trim();
                var county=document.getElementById('tax_county').value.trim();
                var state=document.getElementById('tax_state').value;
                var zip=document.getElementById('tax_zip').value.trim();
                var rc=document.getElementById('tax_results');
                if(!city&&!zip&&!county){rc.innerHTML='<p style=color:#c00>Enter a city, county, or zip code.</p>';return;}
                rc.innerHTML='<p style=color:#555>Calculating…</p>';
                fetch('${suiteletUrl}&city='+encodeURIComponent(city)+'&county='+encodeURIComponent(county)+'&state='+encodeURIComponent(state)+'&zip='+encodeURIComponent(zip))
                .then(function(r){return r.json();})
                .then(function(d){
                    if(d.status!=='success'){
                        rc.innerHTML='<p style=color:#c00>Error: '+(d.message||'Unknown error')+'</p>';
                        return;
                    }
                    var h='';
                    if(d.data&&d.data.length){
                        h+='<table style=width:100%;border-collapse:collapse;font-size:13px;margin-top:8px>';
                        h+='<thead><tr>';
                        h+='<th style=padding:8px;border-bottom:2px solid #ccc;text-align:left>Jurisdiction</th>';
                        h+='<th style=padding:8px;border-bottom:2px solid #ccc;text-align:right>Rate</th>';
                        h+='</tr></thead><tbody>';
                        d.data.forEach(function(row){
                            h+='<tr>';
                            h+='<td style=padding:7px 8px;border-bottom:1px solid #eee>'+row.jurisdiction+'</td>';
                            h+='<td style=padding:7px 8px;border-bottom:1px solid #eee;text-align:right>'+row.rate+'</td>';
                            h+='</tr>';
                        });
                        h+='</tbody>';
                        h+='<tfoot><tr style=font-weight:bold;background:#f4f4f4>';
                        h+='<td style=padding:8px;border-top:2px solid #ccc>Combined Rate</td>';
                        h+='<td style=padding:8px;border-top:2px solid #ccc;text-align:right>'+d.combined_rate+'</td>';
                        h+='</tr></tfoot></table>';
                        var src=(d.source==='engine')?'Calculated by SuiteTax for this address':'From published SuiteTax rate tables';
                        h+='<p style=color:#888;font-size:11px;margin:6px 0 0>'+src+'</p>';
                    }
                    if(d.notes&&d.notes.length){
                        d.notes.forEach(function(n){
                            h+='<p style=color:#8a6100;font-size:11px;margin:5px 0 0>⚠ '+n+'</p>';
                        });
                    }
                    if(d.warning){
                        h+='<p style=color:#c07000;font-size:11px;margin:6px 0 0>⚠ '+d.warning+'</p>';
                    }
                    if(!h){h='<p style=color:#666>No tax data returned. Try adding a county or check spelling.</p>';}
                    rc.innerHTML=h;
                })
                .catch(function(e){
                    console.error(e);
                    rc.innerHTML='<p style=color:#c00>Request failed. Check browser console (F12).</p>';
                });
            `;

            portlet.html = `
    <div style="padding:10px 12px 12px 12px;font-family:'Open Sans',Arial,sans-serif;font-size:13px;">
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px;">
            <input
                type="text"
                id="tax_city"
                placeholder="City (e.g. Memphis)"
                style="padding:6px 10px;border:1px solid #ccc;border-radius:3px;font-size:13px;flex:2 1 130px;min-width:0;"
                onkeydown="if(event.key==='Enter'){event.preventDefault();event.stopPropagation();${fetchAndRender}}"
            />
            <input
                type="text"
                id="tax_county"
                placeholder="County (if no address)"
                style="padding:6px 10px;border:1px solid #ccc;border-radius:3px;font-size:13px;flex:2 1 130px;min-width:0;"
                onkeydown="if(event.key==='Enter'){event.preventDefault();event.stopPropagation();${fetchAndRender}}"
            />
            <select
                id="tax_state"
                style="padding:6px 8px;border:1px solid #ccc;border-radius:3px;font-size:13px;background:#fff;flex:1 1 120px;min-width:0;">
                ${stateOptions}
            </select>
            <input
                type="text"
                id="tax_zip"
                placeholder="Zip / Zip+4 (opt.)"
                style="padding:6px 10px;border:1px solid #ccc;border-radius:3px;font-size:13px;flex:1 1 80px;min-width:0;"
                onkeydown="if(event.key==='Enter'){event.preventDefault();event.stopPropagation();${fetchAndRender}}"
            />
            <button
                style="padding:6px 14px;background:#1063a3;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:13px;white-space:nowrap;flex:0 0 auto;"
                onclick="${fetchAndRender}">Lookup</button>
        </div>
        <div id="tax_results" style="max-height:320px;overflow-y:auto;">
            <p style="color:#666;">Pick a state, then enter whatever you have &mdash; city, county, or zip &mdash; and click Lookup. No address needed.</p>
        </div>
    </div>
`;
        } catch (error) {
            log.error({
                title:   'tax_lookup_portlet_pl_v2 | render error',
                details: JSON.stringify(error)
            });
            params.portlet.html = '<div style="padding:10px;color:red;">Error loading portlet. Contact your administrator.</div>';
        }
    };

    return { render };
});