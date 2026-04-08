import { useReducer, useEffect, createContext, useContext } from 'react';
import type { System, GridCoordinate } from '../types';
import { getAllSystems } from '../api';

interface AppState {
    systems: System[];
    selectedSystem: System | null;
    selectedCoordinate: GridCoordinate | null;
    uiState: {
        loading: boolean;
        error: string | null;
        formVisible: boolean;
    };
}

type AppAction =
    | { type: 'FETCH_SYSTEMS_START'; }
    | { type: 'FETCH_SYSTEMS_SUCCESS'; payload: System[] }
    | { type: 'FETCH_ERROR'; payload: string }
    | { type: 'CLEAR_ERROR'; }
    | { type: 'SELECT_COORDINATE'; payload: GridCoordinate }
    | { type: 'CLEAR_COORDINATE'; }
    | { type: 'SELECT_SYSTEM'; payload: System }
    | { type: 'CLEAR_SYSTEM'; }
    // TODO: user added system functionality
    // | { type: 'OPEN_ADD_FORM'; }
    // | { type: 'CLOSE_ADD_FORM'; }
    // | { type: 'ADD_SYSTEM_SUCCESS'; payload: System }
    // | { type: 'UPDATE_SYSTEM_SUCCESS'; payload: System }                                                                         
    // | { type: 'DELETE_SYSTEM_SUCCESS'; payload: { id: number } }  

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'FETCH_SYSTEMS_START':
            return {
                ...state,
                uiState: { ...state.uiState, loading: true, error: null }
            };
        case 'FETCH_SYSTEMS_SUCCESS':
            return {
                ...state,
                systems: action.payload,
                uiState: { ...state.uiState, loading: false }
            };
        case 'FETCH_ERROR':
            return {
                ...state,
                uiState: { ...state.uiState, loading: false, error: action.payload }
            };
        case 'CLEAR_ERROR':
            return {
                ...state,
                uiState: { ...state.uiState, error: null }
            };
        case 'SELECT_COORDINATE':
            return {
                ...state,
                selectedCoordinate: action.payload
            };
        case 'CLEAR_COORDINATE':
            return {
                ...state,
                selectedCoordinate: null
            };
        case 'SELECT_SYSTEM':
            return {
                ...state,
                selectedSystem: action.payload
            };
        case 'CLEAR_SYSTEM':
            return {
                ...state,
                selectedSystem: null
            };
        default:
            return state;
        // TODO: user added system functionality
    }
}

interface AppContextValue {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const initialState: AppState = {                                                                                               
    systems: [],                                                                                                                 
    selectedCoordinate: null,                                                                                                    
    selectedSystem: null,                                                                                                        
    uiState: {                                                                                                                   
      loading: false,                                                                                                            
      error: null,                                                                                                               
      formVisible: false,                                                                                                        
    },                                                                                                                           
  };

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    useEffect(() => {
        dispatch({ type: 'FETCH_SYSTEMS_START' });
        getAllSystems()
            .then(systems => dispatch({ type: 'FETCH_SYSTEMS_SUCCESS', payload: systems }))
            .catch(error => dispatch({ type: 'FETCH_ERROR', payload: error.message }));
    }, []);

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    const ctx = useContext(AppContext);
    if (ctx === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return ctx;
}

