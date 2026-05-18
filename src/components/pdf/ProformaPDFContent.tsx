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
        <table className="w-full text-[11px] leading-tight" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="border-b-[1.5px] border-black font-black text-center">
              <th className="border-r-[1.5px] border-black p-2 w-[8%]">SL.NO</th>
              <th className="border-r-[1.5px] border-black p-2 text-left">PRODUCT / QUALITY</th>
              <th className="border-r-[1.5px] border-black p-2 w-[12%]">Unit/Box</th>
              <th className="border-r-[1.5px] border-black p-2 w-[15%]">Quantity<br/>( in Kg.)</th>
              <th className="border-r-[1.5px] border-black p-2 w-[15%]">Rate/Kg<br/>( in {currencyText}.)</th>
              <th className="p-2 w-[15%]">Total (In {currencySymbol})</th>
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
                 <tr className={`${isLast ? 'border-b-[1.5px]' : ''} border-black`} key={i}>
                   <td className={`border-r-[1.5px] border-black px-2 py-4 text-center align-top ${isLast ? 'h-[150px]' : ''}`}>{i+1}</td>
                   <td className="border-r-[1.5px] border-black px-2 py-4 align-top font-bold">{item.PRODUCT_QUALITY}</td>
                   <td className="border-r-[1.5px] border-black px-2 py-4 text-right align-top">{item.UNIT_COUNT ? Number(item.UNIT_COUNT).toFixed(2) : ''}</td>
                   <td className="border-r-[1.5px] border-black px-2 py-4 text-right align-top">{q ? q.toFixed(2) : ''}</td>
                   <td className="border-r-[1.5px] border-black px-2 py-4 text-right align-top">{r ? r.toFixed(2) : ''}</td>
                   <td className="px-2 py-4 text-right align-top">{t ? t.toFixed(2) : ''}</td>
                 </tr>
               )
            })}
             
             {/* Total Row */}
             <tr className="border-b-[1.5px] border-black font-black">
               <td colSpan={2} className="border-r-[1.5px] border-black px-2 py-2 text-right">TOTAL</td>
               <td className="border-r-[1.5px] border-black py-2"></td>
               <td className="border-r-[1.5px] border-black px-2 py-2 text-right">{totalQty.toFixed(2)}</td>
               <td className="border-r-[1.5px] border-black py-2"></td>
               <td className="px-2 py-2 text-right">{totalAmount.toFixed(2)}</td>
             </tr>
          </tbody>
        </table>

        {/* Footer info: Bank Details & Signatory */}
        <div className="flex min-h-[120px]">
           {/* Details block */}
           <div className="w-[70%] border-r-[1.5px] border-black p-2 space-y-3">
             {/* Dynamic fields */}
             {pi.PAYMENT_TERMS && (
               <div className="flex gap-2">
                 <div className="w-32 font-bold whitespace-nowrap">Payment Terms</div>
                 <div className="font-bold">: {pi.PAYMENT_TERMS}</div>
               </div>
             )}
             {pi.NOTE && (
               <div className="flex gap-2">
                 <div className="w-32 font-bold whitespace-nowrap">Note</div>
                 <div className="font-bold">: {pi.NOTE}</div>
               </div>
             )}
             {pi.TRANSPORT_MODE && (
               <div className="flex gap-2">
                 <div className="w-32 font-bold whitespace-nowrap">Transport Mode</div>
                 <div className="font-bold">: {pi.TRANSPORT_MODE}</div>
               </div>
             )}

             <div className="mt-4 pt-4 border-t border-black/30">
               <div className="font-bold">BANK DETAILS : HDFC BANK LTD.</div>
               <div className="flex gap-2 mt-1"><div className="w-24">A/c No.</div><div>: 50200057074211</div></div>
               <div className="flex gap-2"><div className="w-24">IFSC Code</div><div>: HDFC0000008</div></div>
               <div className="flex gap-2"><div className="w-24">Branch</div><div>: CENTRAL PLAZA, KOLKATA</div></div>
             </div>
           </div>
           
           {/* Signatory block */}
           <div className="w-[30%] flex flex-col items-center justify-end p-2 relative">
             <div className="text-center font-bold absolute top-2 w-full">For YAJUR FIBRES LIMITED</div>
             
             {/* Signature Image or Text */}
             <div className="mt-10 mb-2 h-16 flex items-center justify-center w-full">
               {pi.AUTHORIZED_SIGNATORY?.startsWith('data:image') ? (
                 <img src={pi.AUTHORIZED_SIGNATORY} alt="Signature" className="max-h-16 object-contain mix-blend-multiply" />
               ) : pi.AUTHORIZED_SIGNATORY ? (
                 <span className="font-black text-[#dc424e] border-b border-[#dc424e] pb-1 tracking-widest">{pi.AUTHORIZED_SIGNATORY}</span>
               ) : (
                 <span className="text-slate-400 italic">Digitally Signed</span>
               )}
             </div>

             <div className="font-bold text-center mt-auto w-full border-t border-black/20 pt-1">
               Authorised Signatory
             </div>
           </div>
        </div>
      </div>
      
      {/* Subject to Kolkata info */}
      <div className="text-center text-[10px] italic mt-1 font-semibold">
        "SUBJECT TO KOLKATA JURISDICTION"
      </div>
    </div>
  );
}
