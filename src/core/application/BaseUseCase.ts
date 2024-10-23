import { IUseCase } from './ports/IUseCase';
import { Either, left } from '../shared/Either';
import { Result } from '../../utils/Result';

export abstract class BaseUseCase<IRequest, IResponse> implements IUseCase<IRequest, IResponse> {
  abstract execute(request: IRequest): Promise<Either<Error, IResponse>>;
  
  protected abstract validate(request: IRequest): Result<any>;
  
  protected async executeImpl(request: IRequest): Promise<Either<Error, IResponse>> {
    const validationResult = this.validate(request);
    
    if (!validationResult.isSuccess) {
      return left(new Error(validationResult.getError()));
    }
    
    return this.execute(request);
  }
}