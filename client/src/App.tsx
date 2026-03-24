import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import Home from "@/pages/Home";
import Player from "@/pages/Player";
import History from "@/pages/History";
import NotFound from "@/pages/not-found";
export default function App() {
  return (
    <Router hook={useHashLocation}>
      <div className="min-h-screen flex flex-col">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/play/:id" component={Player} />
          <Route path="/history" component={History} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </Router>
  );
}
