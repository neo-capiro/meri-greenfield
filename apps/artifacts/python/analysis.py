"""Typed in-memory table work; no eval, code, query strings or source access."""
import io, json, math, zipfile

def analyze(spec, path):
    import pandas as pd
    max_number=9007199254740991
    def numeric(series):
        values=pd.to_numeric(series,errors='raise')
        for value in values:
            if not pd.isna(value) and (not math.isfinite(value) or abs(value)>max_number):raise ValueError('Numeric range unsupported')
        # Explicit floating-point mode avoids pandas signed-int64 wraparound.
        return values.astype('float64')
    tables={t['name']:pd.DataFrame(t['rows'],columns=t['columns']) for t in spec['tables']}
    frame=tables[spec['source']].copy()
    for step in spec['steps']:
        kind=step['kind']
        if kind=='select': frame=frame[step['columns']].copy()
        elif kind=='filter':
            column=frame[step['column']];value=step['value']
            comparisons={'eq':lambda:column.eq(value),'ne':lambda:column.ne(value),'gt':lambda:column.gt(value),'gte':lambda:column.ge(value),'lt':lambda:column.lt(value),'lte':lambda:column.le(value)}
            frame=frame[comparisons[step['operator']]()].copy()
        elif kind=='join':
            right=tables[step['right']]
            if frame[step['leftOn']].isna().any() or right[step['rightOn']].isna().any(): raise ValueError('Null join keys are unsupported')
            frame=frame.merge(right,how=step['how'],left_on=step['leftOn'],right_on=step['rightOn'],validate=step['validate'],suffixes=('_left','_right'))
        elif kind=='derive':
            if step['name'] in frame.columns: raise ValueError('Derived column would overwrite input')
            left=numeric(frame[step['left']])
            right=numeric(frame[step['right']['column']]) if isinstance(step['right'],dict) else float(step['right'])
            if isinstance(right,float) and (not math.isfinite(right) or abs(right)>max_number):raise ValueError('Numeric range unsupported')
            if step['operator']=='divide' and ((right==0).any() if hasattr(right,'any') else right==0): raise ValueError('Division by zero')
            operators={'add':lambda:left+right,'subtract':lambda:left-right,'multiply':lambda:left*right,'divide':lambda:left/right}
            frame[step['name']]=operators[step['operator']]()
        elif kind=='aggregate':
            fn=step['function'];column=step['column'];keys=step['groupBy']
            if fn!='count':frame[column]=numeric(frame[column])
            if keys: frame=frame.groupby(keys,dropna=False,sort=False)[column].agg(fn).reset_index(name=step['name'])
            else: frame=pd.DataFrame({step['name']:[getattr(frame[column],fn)()]})
        elif kind=='sort': frame=frame.sort_values(step['columns'],ascending=step['ascending'],kind='stable')
        else: raise ValueError('Unsupported typed analysis')
        if len(frame)>10000 or len(frame.columns)>200: raise ValueError('Analysis result limit')
    # Explicitly reject infinities; pandas serializes missing values as null.
    for row in frame.itertuples(index=False,name=None):
        for value in row:
            if isinstance(value,(int,float)) and not pd.isna(value) and (not math.isfinite(value) or abs(value)>max_number): raise ValueError('Numeric result range unsupported')
    rows=[]
    for row in frame.itertuples(index=False,name=None):rows.append([None if pd.isna(value) else value.item() if hasattr(value,'item') else value for value in row])
    result={'columns':list(frame.columns),'data':rows}
    result['semantics']={'numeric':'pandas float64 for arithmetic; magnitude<=9007199254740991; not arbitrary-precision accounting','nulls':'JSON null; null join keys refused','codeExecution':False}
    with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as out:
        out.writestr('result.json',json.dumps(result,allow_nan=False,ensure_ascii=False))
        # Exported CSV is data-only JSON's companion; neutralize spreadsheet formulas.
        csv=frame.map(lambda x:"'"+x if isinstance(x,str) and x.startswith(('=','+','-','@')) else x).to_csv(index=False)
        out.writestr('result.csv',csv)
        if 'chart' in spec:
            import matplotlib
            matplotlib.use('Agg')
            from matplotlib import pyplot as plt
            c=spec['chart'];fig,ax=plt.subplots(figsize=(8,4))
            try:
                getattr(ax,c['kind'])(frame[c['x']].astype(str),pd.to_numeric(frame[c['y']],errors='raise')) if c['kind']=='bar' else ax.plot(frame[c['x']].astype(str),pd.to_numeric(frame[c['y']],errors='raise'))
                ax.set_title(c['title']);fig.tight_layout();buffer=io.BytesIO();fig.savefig(buffer,format='png',dpi=100);out.writestr('chart.png',buffer.getvalue())
            finally: plt.close(fig)
    return {'rows':len(frame),'columns':list(frame.columns),'chart': 'chart' in spec}
