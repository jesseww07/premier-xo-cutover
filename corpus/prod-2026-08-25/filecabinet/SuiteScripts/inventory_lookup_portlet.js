/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 */
define(() => {
const render = (params) => {        
            const portlet = params.portlet;          
   portlet.title = 'Inventory Lookup Tool';

params.portlet.html = `
  <iframe 
    src="https://7513000.app.netsuite.com/app/site/hosting/scriptlet.nl?script=3169&deploy=1"
    width="100%" 
    height="450" 
    style="border: none; overflow: auto;">
  </iframe>
`;

  };
  return { render };
});
