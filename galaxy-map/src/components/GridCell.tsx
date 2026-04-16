interface GridCellProps {
    count: number;
    isSelected: boolean;
    onClick: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

function dotCount(count: number): 0 | 1 | 3 | 4 {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 10) return 3;
    return 4;
}

export function GridCell({ count, isSelected, onClick, onMouseEnter, onMouseLeave }: GridCellProps) {                
    const dots = dotCount(count);                                                                                                
                                                                                                                                 
    const classes = [                                                                                                            
      'cell',                                                                                                                    
      isSelected ? 'cell--selected' : '',                                                                                        
    ].filter(Boolean).join(' ');                                                                                                 
                                                                                                                                 
    return (                                                                                                                     
      <div                                                                                                                       
        className={classes}                                                                                                      
        onClick={onClick}                                                                                                        
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {dots > 0 && (                                                                                                           
          <div className={`cell__dots cell__dots--${dots}`}>                                                                     
            {Array.from({ length: dots }, (_, i) => (                                                                            
              <span key={i} className="cell__dot" />                                                                             
            ))}                                                                                                                  
          </div>                                                                                                                 
        )}                                                                                                                       
                                                                                                                                 
        {isSelected && (                                                                                                         
          <>
            <span className="cell__tick cell__tick--tl" />                                                                       
            <span className="cell__tick cell__tick--tr" />                                                                       
            <span className="cell__tick cell__tick--bl" />                                                                       
            <span className="cell__tick cell__tick--br" />                                                                       
          </>                                                                                                                    
        )}                                                                                                                       
      </div>                                                                                                                     
    );                                                                                                                           
  } 