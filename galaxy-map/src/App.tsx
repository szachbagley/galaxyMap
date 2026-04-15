import { useAppContext } from './context/AppContext.tsx';
import './App.css'
import { Grid } from './components/Grid.tsx';

function App() {
  // const { state, dispatch } = useAppContext();

  return (
    <>
      <Grid />
    </>
  )
}

export default App
