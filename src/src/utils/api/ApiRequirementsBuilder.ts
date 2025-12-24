
import { useUserStore } from '../../zustand/userStore';
import { UserApi } from './UserApi';


interface IApiReuqirement {
  needsFetch(): Boolean;
  fetchPredicate(): Boolean;
  fetch(): Promise<void>;
  fetchIfNeeded(): Promise<void>;
  getPriority(): number;
}

/**
 * Abstract class for API requirements.
 *
 * This class provides a structure for API requirements to not fetch data to often.
 * Singleton pattern is used to ensure that only one instance of each requirement exists, which
 * also helps keeping track of whether the data has been fetched or not.
 *
 * main method is `fetchIfNeeded` and `fetch`. FetchIfNeeded will check, if the data needs to be fetched
 * and call `fetch` if necessary. `fetch` executes the actual fetching logic and sets the `hasFetched` flag to true.
 * The fetching logic is implemented in the `doFetch` method, which needs to be overridden by subclasses.
 */
abstract class ApiRequirementABC implements IApiReuqirement {
  private static instances = new Map<string, ApiRequirementABC>();

  protected hasFetched = false;
  protected fetchPromise: Promise<void> | null = null;
  protected lastResult: any = null;

  constructor() {}

  static getInstance<T extends ApiRequirementABC>(this: new () => T): T {
    const className = this.name;
    if (!ApiRequirementABC.instances.has(className)) {
      ApiRequirementABC.instances.set(
        className,
        new this() as ApiRequirementABC
      );
    }
    return ApiRequirementABC.instances.get(className) as T;
  }

  needsFetch(): boolean {
    return !this.hasFetched;
  }

  /**
   * @deprecated
   *
   * Use `needsFetch` instead.
   */
  abstract fetchPredicate(): Boolean;

  async fetch(): Promise<void> {
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      try {
        this.lastResult = await this.doFetch();
        this.hasFetched = true;
      } finally {
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }

  getLastResult(): any {
    return this.lastResult;
  }

  async fetchIfNeeded(): Promise<void> {
    if (this.needsFetch()) {
      await this.fetch();
    }
  }

  protected abstract doFetch(): Promise<any>;

  getPriority(): number {
    return 1;
  }
}

/**
 * tries to authenticate a user by coockie.
 * It sets `useUserStore` to the authenticated user
 * */
export class UserRequirement extends ApiRequirementABC {
  fetchPredicate(): Boolean {
    console.log(`DEBUG: Checking if user needs fetch`);
    return useUserStore.getState().user === null;
  }

  async doFetch(): Promise<void> {
    console.log(`DEBUG: Fetching user data`);
    await new UserApi().fetchUser();
  }

  getPriority(): number {
    return 0; // User requirement has the highest priority
  }
}


export enum ApiRequirement {
  User,
  TotalScore,
  Friends,
  Streak,
  AllStreaks,
  AllRecentSports,
  YourRecentSports,
  Preferences,
  OverdueDeaths,
}

export namespace ApiRequirement {
  export function toRequirement(req: ApiRequirement): IApiReuqirement {
    switch (req) {
      case ApiRequirement.User:
        return UserRequirement.getInstance();
      default:
        throw new Error(`Unknown ApiRequirement: ${req}`);
    }
  }
}

/**
 * Class, to set, which API data is needed. This data is
 * fetched, in case it's null/undefined. Otherwise it will
 * ignore it. => It acts as assertion, that some responses are present
 */
export class ApiRequirementsBuilder {
  requirements: IApiReuqirement[];

  constructor() {
    this.requirements = [];
  }

  add(requirement: ApiRequirement): ApiRequirementsBuilder {
    this.requirements.push(ApiRequirement.toRequirement(requirement));
    return this;
  }

  async forceFetch(): Promise<void> {
    var promises: Promise<void>[] = [];
    for (let requirement of this.requirements) {
      promises.push(requirement.fetch());
    }

    await Promise.all(promises);
  }

  async fetchIfNeeded(): Promise<void> {
    var requirements: IApiReuqirement[][] = [[], [], []];
    for (let requirement of this.requirements) {
      requirements[requirement.getPriority()]?.push(requirement);
    }
    for (let requirementList of requirements) {
      var promises: Promise<void>[] = [];
      for (let requirement of requirementList) {
        promises.push(requirement.fetchIfNeeded());
      }
      await Promise.all(promises);
    }
  }
}
