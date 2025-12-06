import { useThemeStore } from "../../zustand/useThemeStore"

export const MainPage: React.FC = () => {
    //const {theme} = useThemeStore();
    return (
        <div 
        style={{
        minHeight: '100vh', 
        padding: '1rem'}
        }>
            <h1>Welcome to the Main Page</h1>
            <p>This is a sample main page using the current theme.</p>
        </div>
    )
}