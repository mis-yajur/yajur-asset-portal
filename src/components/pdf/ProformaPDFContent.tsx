import React from 'react';

interface Props {
  pi: any;
}

export default function ProformaPDFContent({ pi }: Props) {
  if (!pi) return null;

  const items = (typeof pi.ITEMS === 'string') ? JSON.parse(pi.ITEMS) : (pi.ITEMS || []);
  if (items.length === 0) {
      items.push({ PRODUCT_QUALITY: pi.PRODUCT_QUALITY, QUANTITY_KG: pi.QUANTITY_KG, RATE_PER_UNIT: pi.RATE_PER_UNIT, UNIT_COUNT: pi.UNIT_COUNT });
  }

  let totalQty = 0;
  let totalAmount = 0;
  items.forEach((it: any) => {
      totalQty += Number(it.QUANTITY_KG) || 0;
      totalAmount += (Number(it.QUANTITY_KG) || 0) * (Number(it.RATE_PER_UNIT) || 0);
  });

  const currencySymbol = pi.CURRENCY === '$' ? '$' : pi.CURRENCY === '€' ? '€' : 'Rs.';
  const currencyText = pi.CURRENCY === '$' ? 'Dollar' : pi.CURRENCY === '€' ? 'Euro' : 'Rs.';

  return (
    <div id="pdf-template" className="w-[800px] bg-white text-black font-sans pb-10 box-border p-8" style={{ fontSize: '11px' }}>
      <div className="border-[1.5px] border-black">
        {/* Title */}
        <div className="border-b-[1.5px] border-black text-center py-2 font-black text-lg tracking-wide uppercase">
          PROFORMA INVOICE
        </div>

        {/* Header Block */}
        <div className="flex border-b-[1.5px] border-black">
          {/* Logo */}
          <div className="w-[20%] border-r-[1.5px] border-black p-2 flex flex-col items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-16 h-16 text-[#e97b7a] fill-current">
               {/* Dummy Lotus */}
               <path d="M50 70 Q30 80 15 60 Q30 40 50 70 Z" className="text-rose-400" />
               <path d="M50 70 Q70 80 85 60 Q70 40 50 70 Z" className="text-rose-400" />
               <path d="M50 70 Q10 70 5 40 Q30 30 50 70 Z" className="text-rose-300" />
               <path d="M50 70 Q90 70 95 40 Q70 30 50 70 Z" className="text-rose-300" />
               <path d="M50 70 Q30 10 50 5 Q70 10 50 70 Z" className="text-rose-500" />
            </svg>
            <div className="text-lg font-black text-[#dc424e] tracking-widest mt-1">YAJUR:</div>
          </div>
          
          {/* Company Info */}
          <div className="w-[50%] border-r-[1.5px] border-black p-3 text-center leading-tight space-y-1">
            <div className="font-black text-sm uppercase">YAJUR FIBRES LIMITED</div>
            <div>5, MIDDLETON STREET, RUSSEL STREET AREA</div>
            <div>KOLKATA, PIN - 700071, WEST BENGAL, INDIA</div>
            <div>CONTACT NO. +91-9903862793</div>
            <div><span className="text-blue-700">E-mail : sales@yajurfibres.com</span></div>
            <div>CIN : U17100WB1980PLC032918</div>
            <div>GSTIN : 19AAECS2882B3ZB</div>
          </div>

          {/* Certificate & Invoice */}
          <div className="w-[30%] p-3 leading-tight flex flex-col">
            <div className="flex items-center gap-1 mb-2">
              <div className="w-4 h-6 border-l border-green-700 border-r" style={{ borderLeftStyle: 'dotted' }}></div>
              <div className="text-[#647c2d] font-black text-base tracking-tight leading-none">European Flax.<br/><span className="text-[7px] font-normal text-[#8ba63b]">Premium linen fiber</span></div>
            </div>
            <div className="font-bold">Certificate No: BVFR14492922</div>
            <div className="mt-auto">
              <div>PROFORMA INVOICE NO :</div>
              <div className="font-bold">{pi.PI_NO}</div>
              <div className="uppercase">DATE : {new Date(pi.INVOICE_DATE || Date.now()).toLocaleDateString('en-GB')}</div>
            </div>
          </div>
        </div>

        {/* Consignee / Delivery Titles */}
        <div className="flex border-b-[1.5px] border-black font-black text-center">
          <div className="w-1/2 border-r-[1.5px] border-black py-1">CONSIGNEE</div>
          <div className="w-1/2 py-1">DELIVERY</div>
        </div>

        {/* Address Content */}
        <div className="flex border-b-[1.5px] border-black min-h-[100px]">
           <div className="w-1/2 border-r-[1.5px] border-black p-3 whitespace-pre-wrap leading-tight">
             {(() => {
                const lines = [];
                if (pi.CUSTOMER_NAME && pi.CUSTOMER_NAME !== 'GENERAL ACCOUNT') lines.push(`M/s \t${pi.CUSTOMER_NAME}`);
                else if (pi.CUSTOMER_NAME === 'GENERAL ACCOUNT') lines.push(`M/s \t`);
                if (pi.CUSTOMER_ADDRESS) lines.push(pi.CUSTOMER_ADDRESS);
                if (pi.CUSTOMER_GST_NO) lines.push(`GSTIN : \t\t${pi.CUSTOMER_GST_NO}`);
                return lines.join('\n');
             })()}
           </div>
           <div className="w-1/2 p-3 whitespace-pre-wrap leading-tight">
             {(() => {
                const lines = [];
                const dName = pi.DELIVERY_NAME || pi.CUSTOMER_NAME;
                if (dName && dName !== 'GENERAL ACCOUNT') lines.push(`M/s \t${dName}`);
                if (pi.DELIVERY_ADDRESS || pi.CUSTOMER_ADDRESS) lines.push(pi.DELIVERY_ADDRESS || pi.CUSTOMER_ADDRESS);
                if (pi.DELIVERY_GST_NO || pi.CUSTOMER_GST_NO) lines.push(`GSTIN : \t\t${pi.DELIVERY_GST_NO || pi.CUSTOMER_GST_NO}`);
                return lines.join('\n');
             })()}
           </div>
        </div>

        {/* Table */}
        <table className="w-full text-[11px] leading-tight border-b-[1.5px] border-black" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="border-[1.5px] border-black font-black text-center">
              <th className="border-r-[1.5px] border-black p-2 w-[8%]">SL.NO</th>
              <th className="border-r-[1.5px] border-black p-2 text-left">PRODUCT / QUALITY</th>
              <th className="border-r-[1.5px] border-black p-2 w-[12%]">Unit/Box</th>
              <th className="border-r-[1.5px] border-black p-2 w-[15%]">Quantity<br/>( in Kg.)</th>
              <th className="border-r-[1.5px] border-black p-2 w-[15%]">Rate/Kg<br/>{currencySymbol}</th>
              <th className="p-2 w-[15%] border-black">Total<br/>{currencySymbol}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, i: number) => {
               const q = Number(item.QUANTITY_KG)||0;
               const r = Number(item.RATE_PER_UNIT)||0;
               const t = q * r;
               // Apply bottom border only to the last item
               const isLast = i === items.length - 1;
               return (
                 <tr className={`${isLast ? 'border-b-[1.5px]' : ''} border-black font-bold`} key={i}>
                   <td className={`border-r-[1.5px] border-black px-2 py-4 text-center align-top ${isLast ? 'h-[150px]' : ''}`}>{i+1}</td>
                   <td className="border-r-[1.5px] border-black px-2 py-4 align-top">{item.PRODUCT_QUALITY}</td>
                   <td className="border-r-[1.5px] border-black px-2 py-4 text-right align-top break-all">{item.UNIT_COUNT ? item.UNIT_COUNT : ''}</td>
                   <td className="border-r-[1.5px] border-black px-2 py-4 text-right align-top">{q ? q.toFixed(2) : ''}</td>
                   <td className="border-r-[1.5px] border-black px-2 py-4 text-right align-top">{r ? r.toFixed(2) : ''}</td>
                   <td className="px-2 py-4 text-right align-top">{t ? t.toFixed(2) : ''}</td>
                 </tr>
               )
            })}
             
             {/* Total Row */}
             <tr className="border-b-[1.5px] border-black font-black">
               <td colSpan={2} className="border-r-[1.5px] border-black px-2 py-2 text-left">TOTAL :</td>
               <td className="border-r-[1.5px] border-black py-2 px-2 text-right">0.00</td>
               <td className="border-r-[1.5px] border-black px-2 py-2 text-right">{totalQty.toFixed(2)}</td>
               <td className="border-r-[1.5px] border-black py-2"></td>
               <td className="px-2 py-2 text-right">{totalAmount.toFixed(2)}</td>
             </tr>

             {/* Additional Rows */}
             <tr className="border-b-[1.5px] border-black font-bold">
               <td colSpan={2} className="border-r-[1.5px] border-black px-2 py-1">Add : Delivery Charges</td>
               <td className="border-r-[1.5px] border-black px-2 py-1 font-black text-center">To Pay</td>
               <td className="border-r-[1.5px] border-black px-2 py-1"></td>
               <td className="border-r-[1.5px] border-black px-2 py-1 text-right">Delivery Charges &gt;&gt;</td>
               <td className="px-2 py-1 text-right">0.00</td>
             </tr>

             <tr className="border-b-[1.5px] border-black font-bold">
               <td colSpan={5} className="border-r-[1.5px] border-black px-2 py-1">Total Amount Before Tax :</td>
               <td className="px-2 py-1 text-right">{(totalAmount).toFixed(2)}</td>
             </tr>

             <tr className="border-b-[1.5px] border-black font-bold">
               <td colSpan={4} className="border-r-[1.5px] border-black px-2 py-1">Add : CGST</td>
               <td className="border-r-[1.5px] border-black px-2 py-1 text-center">&lt;&lt;CGST%&gt;&gt;</td>
               <td className="px-2 py-1 text-right"></td>
             </tr>

             <tr className="border-b-[1.5px] border-black font-bold">
               <td colSpan={4} className="border-r-[1.5px] border-black px-2 py-1">Add : SGST</td>
               <td className="border-r-[1.5px] border-black px-2 py-1 text-center">&lt;&lt;SGST%&gt;&gt;</td>
               <td className="px-2 py-1 text-right"></td>
             </tr>

             <tr className="border-b-[1.5px] border-black font-bold">
               <td colSpan={4} className="border-r-[1.5px] border-black px-2 py-1">Add : IGST</td>
               <td className="border-r-[1.5px] border-black px-2 py-1 text-center">&lt;&lt;IGST%&gt;&gt;</td>
               <td className="px-2 py-1 text-right"></td>
             </tr>

             <tr className="border-b-[1.5px] border-black font-bold">
               <td colSpan={4} className="border-r-[1.5px] border-black px-2 py-1">Other Charges :</td>
               <td className="border-r-[1.5px] border-black px-2 py-1 text-right">&lt;&lt;other_charg</td>
               <td className="px-2 py-1 text-right"></td>
             </tr>

             <tr className="border-b-[1.5px] border-black font-bold">
               <td colSpan={5} className="border-r-[1.5px] border-black px-2 py-1">Net Amount : (In Rs.)</td>
               <td className="px-2 py-1 text-right">{(pi.NET_AMOUNT || totalAmount).toFixed(2)}</td>
             </tr>

             {/* Footer Sections */}
             <tr className="border-b-[1.5px] border-black font-bold">
               <td className="border-r-[1.5px] border-black px-2 py-1">Payment</td>
               <td colSpan={5} className="px-2 py-1">{pi.PAYMENT_TERMS || '<<Payment Terms>>'}</td>
             </tr>
             
             <tr className="border-b-[1.5px] border-black font-bold">
               <td className="border-r-[1.5px] border-black px-2 py-1">Note :</td>
               <td colSpan={5} className="px-2 py-1">{pi.NOTE || '<<Note>>'}</td>
             </tr>

             <tr className="border-b-[1.5px] border-black font-bold">
               <td colSpan={2} className="border-r-[1.5px] border-black px-2 py-1">Consignment Note : {pi.CONSIGNMENT_NOTE || '<<Consignment Note>>'}</td>
               <td colSpan={4} className="px-2 py-1"></td>
             </tr>

             <tr className="border-b-[1.5px] border-black font-bold">
               <td colSpan={2} className="border-r-[1.5px] border-black px-2 py-1">Vehicle No. : {pi.VEHICLE_NO || '<<Vehicle No>>'}</td>
               <td colSpan={4} className="px-2 py-1">Transporat Mode: {pi.TRANSPORT_MODE || '<<Transporat Mode>>'}</td>
             </tr>
          </tbody>
        </table>

        {/* Footer info: Bank Details & Signatory */}
        <div className="flex h-[180px]">
           {/* Details block */}
           <div className="w-[65%] border-r-[1.5px] border-black p-2 flex flex-col justify-between font-bold">
             <div>
               <div className="underline mb-1">Bank Details</div>
               <div className="uppercase">YAJUR FIBRES LIMITED</div>
               <table className="mt-1 w-full text-[11px]">
                 <tbody>
                   <tr><td className="w-24">BANK</td><td>ICICI BANK LTD</td></tr>
                   <tr><td>BRANCH :</td><td>MIDDLETON STREET, KOLKATA-71</td></tr>
                   <tr><td>A/C NO</td><td>355051000003</td></tr>
                   <tr><td>RTGS CODE :</td><td>ICIC0003550</td></tr>
                 </tbody>
               </table>
             </div>
           </div>
           
           {/* Signatory block */}
           <div className="w-[35%] flex flex-col justify-between p-2 relative font-bold">
             <div className="uppercase pb-1">YAJUR FIBRES LIMITED</div>
             
             {/* Signature Image or Text */}
             <div className="flex items-center justify-center flex-1 w-full">
               {(pi.AUTHORIZED_SIGNATORY?.startsWith('http') || pi.AUTHORIZED_SIGNATORY?.startsWith('data:image')) ? (
                 <img src={pi.AUTHORIZED_SIGNATORY} alt="Signature" className="max-h-24 max-w-full object-contain mix-blend-multiply" crossOrigin="anonymous" />
               ) : pi.AUTHORIZED_SIGNATORY ? (
                 <span className="font-black text-[#dc424e] border-[#dc424e] tracking-widest">{pi.AUTHORIZED_SIGNATORY}</span>
               ) : (
                 <span>&lt;&lt;Digitally signed&gt;&gt;</span>
               )}
             </div>

             <div className="w-full">
               Authorised Signatory
             </div>
           </div>
        </div>
      </div>
      
      {/* Subject to Kolkata info */}
      <div className="mt-2 font-bold text-left ml-2" style={{ fontSize: '10px' }}>
        Regd . Office : 5, MIDDLETON STREET, KOLKATA - 700071, WEST BENGAL, INDIA, M - 9903862793
      </div>
    </div>
  );
}
