import { Either } from "../../shared/Either";

export interface IUseCase<IRequest, IResponse> {
    execute(request: IRequest): Promise<Either<Error, IResponse>>;
}