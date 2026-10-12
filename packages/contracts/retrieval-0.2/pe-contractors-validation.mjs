// Correlates only the returned grouped rows, never the unreturned award universe.
export function assertPeContractorCorrelations(page) {
  if(page.todo!==null)return;
  const fail=()=>{throw new Error('PE contractor projection correlation failed');};
  const seen=new Set();let prior=Infinity;
  for(const row of page.data){
    if(seen.has(row.contractorName)||row.amount>prior)fail();
    seen.add(row.contractorName);prior=row.amount;
    const expected=row.source==='direct'?'Award attributed to this program element':'Linked via DoD Acquisition Program (USAspending)';
    if(row.attribution!==expected)fail();
  }
  prior=Infinity;
  for(const row of page.namedPrimes){
    const order=row.totalCostM??-1;if(order>prior)fail();prior=order;
    const expected=`Named prime per ${row.publisher??'DoD'} FY${row.fy??''} R-3 exhibit${row.pageNumber?` (p. ${row.pageNumber})`:''}`;
    if(row.attribution!==expected)fail();
  }
  const exhibit=page.evidence.governmentExhibit,awards=page.evidence.federalAwards;
  const totals=source=>page.data.filter(row=>row.source===source).reduce((out,row)=>
    ({amountM:out.amountM+row.amount,count:out.count+row.awards}),{amountM:0,count:0});
  const direct=totals('direct'),candidate=totals('program');
  const namedMoney=page.namedPrimes.reduce((sum,row)=>sum+(row.totalCostM??0),0);
  if(exhibit.amountM!==namedMoney||exhibit.count!==page.namedPrimes.length||
      awards.amountM!==direct.amountM+candidate.amountM||awards.count!==direct.count+candidate.count)fail();
  for(const [index,total]of [direct,candidate,{amountM:0,count:0}].entries()){
    if(awards.buckets[index].amountM!==total.amountM||awards.buckets[index].count!==total.count)fail();
  }
}
