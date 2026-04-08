import { useAppContext } from './context/AppContext.tsx';
import './App.css'

function App() {
  const { state, dispatch } = useAppContext();

  return (
    <>
      <section id="center">
        <h1>Systems:</h1>
        <ul>
          {state.systems.map((system) => (
            <li key={system.id}>{system.name}</li>
          ))}
        </ul>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
